import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { CORE_FEATURES, type FeatureKey } from "@heatflow/utils/constants";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

const MODULE_PRICES: Record<string, { eur: number; perUser?: boolean; label: string }> = {
  "m1.datanorm":         { eur: 9, label: "Datanorm-Import" },
  "m2.ids_connect":      { eur: 19, label: "IDS Connect" },
  "m3.maintenance":      { eur: 15, label: "Wartungsverträge & Anlagen" },
  "m4.planning":         { eur: 12, perUser: true, label: "Plantafel" },
  "m5.calculation":      { eur: 10, label: "Soll/Ist-Kalkulation" },
  "m6.warehouse":        { eur: 15, label: "Lagerverwaltung" },
  "m7.funding":          { eur: 19, label: "Förderungsmanagement" },
  "m8.heat_load":        { eur: 9, label: "Heizlast-Anbindung" },
  "m9.manufacturer_api": { eur: 19, label: "Hersteller-APIs" },
  "m10.datev":           { eur: 15, label: "DATEV / RZL / BMD Export" },
  "m11.sepa":            { eur: 12, label: "SEPA & Mahnwesen" },
  "m12.flow_ai":         { eur: 29, perUser: true, label: "FlowAI" },
  "m13.checklists":      { eur: 9, label: "Checklisten" },
  "m14.kanban":          { eur: 9, label: "Kanban + Projekt-Chat" },
};
const CORE_PRICE_PER_USER = 19;

export const billingRouter = router({
  /** Returns plan + active modules + monthly cost breakdown. */
  overview: protectedProcedure.query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, ctx.tenantId))
      .limit(1);
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

    const features = await ctx.db
      .select()
      .from(schema.tenantFeatures)
      .where(and(eq(schema.tenantFeatures.tenantId, ctx.tenantId), eq(schema.tenantFeatures.active, true)));

    const [{ userCount }] = await ctx.db
      .select({ userCount: sql<string>`count(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.tenantId, ctx.tenantId), eq(schema.users.active, true)));
    const users = Number(userCount ?? 1);

    // Compute breakdown
    const lineItems: Array<{ label: string; qty: number; unit: number; total: number; kind: "core" | "module" }> = [];
    lineItems.push({ label: "HeatFlow Core", qty: users, unit: CORE_PRICE_PER_USER, total: users * CORE_PRICE_PER_USER, kind: "core" });

    for (const f of features) {
      if (CORE_FEATURES.includes(f.featureKey as FeatureKey)) continue;
      const price = MODULE_PRICES[f.featureKey];
      if (!price) continue;
      const qty = price.perUser ? users : 1;
      lineItems.push({
        label: price.label,
        qty,
        unit: price.eur,
        total: qty * price.eur,
        kind: "module",
      });
    }

    const totalMonthly = lineItems.reduce((s, l) => s + l.total, 0);
    const totalYearly = totalMonthly * 12;

    return {
      tenant: {
        plan: tenant.plan,
        trialEndsAt: tenant.trialEndsAt,
        billingEmail: tenant.billingEmail,
        currentPeriodEnd: tenant.currentPeriodEnd,
        stripeCustomerId: tenant.stripeCustomerId,
      },
      users,
      lineItems,
      totalMonthly,
      totalYearly,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    };
  }),

  /** Toggle a module on/off. In demo plan: free; in active plan: would charge via Stripe. */
  setModule: protectedProcedure
    .input(z.object({ featureKey: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Don't allow disabling core features
      if (CORE_FEATURES.includes(input.featureKey as FeatureKey) && !input.active) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Core-Module können nicht deaktiviert werden." });
      }
      if (!MODULE_PRICES[input.featureKey] && !CORE_FEATURES.includes(input.featureKey as FeatureKey)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unbekanntes Modul: ${input.featureKey}` });
      }

      // Upsert tenant_features
      const [existing] = await ctx.db
        .select({ tenantId: schema.tenantFeatures.tenantId })
        .from(schema.tenantFeatures)
        .where(and(
          eq(schema.tenantFeatures.tenantId, ctx.tenantId),
          eq(schema.tenantFeatures.featureKey, input.featureKey),
        ))
        .limit(1);

      if (existing) {
        await ctx.db
          .update(schema.tenantFeatures)
          .set({ active: input.active, priceMonthly: String(MODULE_PRICES[input.featureKey]?.eur ?? 0) })
          .where(and(
            eq(schema.tenantFeatures.tenantId, ctx.tenantId),
            eq(schema.tenantFeatures.featureKey, input.featureKey),
          ));
      } else {
        await ctx.db.insert(schema.tenantFeatures).values({
          tenantId: ctx.tenantId,
          featureKey: input.featureKey,
          active: input.active,
          priceMonthly: String(MODULE_PRICES[input.featureKey]?.eur ?? 0),
        });
      }

      // TODO: in active plan, sync subscription with Stripe API here
      return { featureKey: input.featureKey, active: input.active };
    }),

  /**
   * Upgrade-Stub. In a real Stripe integration this would create a Checkout
   * Session and return the URL. For V1 we just flip the plan to "trial".
   */
  startTrial: protectedProcedure.mutation(async ({ ctx }) => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    await ctx.db
      .update(schema.tenants)
      .set({ plan: "trial", trialEndsAt: trialEnd })
      .where(eq(schema.tenants.id, ctx.tenantId));
    return { plan: "trial", trialEndsAt: trialEnd };
  }),

  /** Stub: would call stripe.billingPortal.sessions.create() and return URL. */
  openBillingPortal: protectedProcedure.mutation(async () => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Stripe nicht konfiguriert. Setze STRIPE_SECRET_KEY in .env.local oder kontaktiere uns.",
      });
    }
    // TODO: Real implementation:
    //   const portal = await stripe.billingPortal.sessions.create({ customer: tenant.stripeCustomerId, return_url: ... })
    //   return { url: portal.url };
    return { url: "https://billing.stripe.com/p/login/demo" };
  }),
});

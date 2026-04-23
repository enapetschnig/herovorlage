import { router, protectedProcedure, publicProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor, newId } from "@heatflow/utils/ids";
import { CORE_FEATURES, type FeatureKey } from "@heatflow/utils/constants";
import { hashPassword } from "@heatflow/auth/password";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_PIPELINE_STAGES = [
  "Erstgespräch",
  "Vor-Ort-Termin",
  "Heizlast-Berechnung",
  "Angebot erstellt",
  "Angebot angenommen",
  "Förderung beantragt",
  "Material bestellt",
  "Montage geplant",
  "Montage läuft",
  "Inbetriebnahme",
  "Abnahme + Unterschrift",
  "Rechnung gestellt",
  "Bezahlt",
];

const signupSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(160).optional(),
  country: z.enum(["AT", "DE", "CH"]).default("AT"),
  street: z.string().trim().max(200).optional(),
  zip: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  vatId: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email(),
  ownerName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(200),
  modules: z.array(z.string()).default([]),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const tenantRouter = router({
  current: protectedProcedure.query(async ({ ctx }) => {
    const [t] = await ctx.db
      .select()
      .from(schema.tenants)
      .where(and(eq(schema.tenants.id, ctx.tenantId), isNull(schema.tenants.deletedAt)))
      .limit(1);
    return t ?? null;
  }),

  features: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.tenantFeatures)
      .where(eq(schema.tenantFeatures.tenantId, ctx.tenantId));
  }),

  /** Returns the tenant's configurable project pipeline stages. */
  pipelineStages: protectedProcedure.query(async ({ ctx }) => {
    const [t] = await ctx.db
      .select({ settings: schema.tenants.settings })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, ctx.tenantId))
      .limit(1);
    const raw = (t?.settings as Record<string, unknown> | null)?.pipelineStages;
    return Array.isArray(raw) && raw.every((s) => typeof s === "string")
      ? (raw as string[])
      : DEFAULT_PIPELINE_STAGES;
  }),

  /** Pipeline stages + count of active (non-finalized) projects per stage — for sidebar. */
  pipelineStagesWithCounts: protectedProcedure.query(async ({ ctx }) => {
    const [t] = await ctx.db
      .select({ settings: schema.tenants.settings })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, ctx.tenantId))
      .limit(1);
    const raw = (t?.settings as Record<string, unknown> | null)?.pipelineStages;
    const stages: string[] =
      Array.isArray(raw) && raw.every((s) => typeof s === "string")
        ? (raw as string[])
        : DEFAULT_PIPELINE_STAGES;

    const rows = await ctx.db
      .select({
        stage: schema.projects.pipelineStage,
        cnt: sql<string>`count(*)`,
      })
      .from(schema.projects)
      .where(and(eq(schema.projects.tenantId, ctx.tenantId), isNull(schema.projects.deletedAt)))
      .groupBy(schema.projects.pipelineStage);

    const counts = new Map<string | null, number>();
    for (const r of rows) counts.set(r.stage, Number(r.cnt ?? 0));

    return {
      stages: stages.map((name) => ({ name, count: counts.get(name) ?? 0 })),
      unassigned: counts.get(null) ?? 0,
    };
  }),

  /** Updates the configurable project pipeline stages. Admin-only for safety. */
  updatePipelineStages: protectedProcedure
    .input(z.object({ stages: z.array(z.string().trim().min(1).max(60)).min(1).max(30) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Nur Admins dürfen Pipeline-Stufen ändern." });
      }
      // Dedupe while preserving order
      const seen = new Set<string>();
      const stages = input.stages.filter((s) => (seen.has(s) ? false : seen.add(s)));
      await ctx.db
        .update(schema.tenants)
        .set({
          settings: sql`jsonb_set(coalesce(settings, '{}'::jsonb), '{pipelineStages}', ${JSON.stringify(stages)}::jsonb, true)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.tenants.id, ctx.tenantId));
      return { stages };
    }),

  members: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        active: schema.users.active,
        avatarUrl: schema.users.avatarUrl,
      })
      .from(schema.users)
      .where(and(eq(schema.users.tenantId, ctx.tenantId), isNull(schema.users.deletedAt)))
      .orderBy(schema.users.name);
  }),

  /**
   * Public signup — creates a new tenant + admin user atomically and seeds
   * sensible defaults so the new tenant is immediately productive.
   */
  signup: publicProcedure.input(signupSchema).mutation(async ({ ctx, input }) => {
    // Reject if email already used
    const [existing] = await ctx.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email))
      .limit(1);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "E-Mail-Adresse ist bereits registriert." });
    }

    // Generate unique slug from company name
    const baseSlug = input.companyName
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .slice(0, 60) || "tenant";
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const [s] = await ctx.db
        .select({ id: schema.tenants.id })
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, slug))
        .limit(1);
      if (!s) break;
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }

    const tenantId = idFor.tenant();
    const userId = idFor.user();
    const passwordHash = await hashPassword(input.password);

    await ctx.db.transaction(async (tx) => {
      // 1. Tenant
      await tx.insert(schema.tenants).values({
        id: tenantId,
        name: input.companyName,
        legalName: input.legalName ?? input.companyName,
        slug,
        country: input.country,
        currency: input.country === "CH" ? "CHF" : "EUR",
        locale: input.country === "DE" ? "de-DE" : "de-AT",
        vatId: input.vatId ?? null,
        addressStreet: input.street ?? null,
        addressZip: input.zip ?? null,
        addressCity: input.city ?? null,
        addressCountry: input.country,
        email: input.email,
        primaryColor: "#1e6fff",
        settings: { onboarded: true, signupAt: new Date().toISOString() },
      });

      // 2. Admin user (Owner-Rolle)
      await tx.insert(schema.users).values({
        id: userId,
        tenantId,
        email: input.email,
        name: input.ownerName,
        passwordHash,
        role: "owner",
        active: true,
      });

      // 3. Activate Core features (always) + selected paid modules
      const features: FeatureKey[] = [...CORE_FEATURES, ...(input.modules as FeatureKey[])];
      for (const f of features) {
        await tx.insert(schema.tenantFeatures).values({
          tenantId,
          featureKey: f,
          active: true,
        });
      }

      // 4. Seed default project types (heat-pump preset for SHK businesses)
      const heatPumpStages = [
        "Beratung", "Vor-Ort-Termin", "Heizlast", "Angebot", "Förderung beantragt",
        "Auftrag", "Materialbestellung", "Installation", "Inbetriebnahme", "Abnahme", "Rechnung", "Wartung",
      ];
      for (const [name, color, trade] of [
        ["Wärmepumpe Luft/Wasser", "#0ea5e9", "SHK"],
        ["Wärmepumpe Sole/Wasser", "#0284c7", "SHK"],
        ["PV + WP Kombi", "#f59e0b", "Elektro+SHK"],
        ["Wartung & Service", "#10b981", "SHK"],
      ] as const) {
        await tx.insert(schema.projectTypes).values({
          id: idFor.projectType(),
          tenantId,
          name,
          color,
          trade,
          defaultStages: heatPumpStages,
        });
      }

      // 5. Time categories
      for (const [name, color, billable] of [
        ["Umsetzung", "#10b981", true],
        ["Fahrzeit", "#f59e0b", true],
        ["Büro", "#6366f1", false],
        ["Wartung", "#0ea5e9", true],
      ] as const) {
        await tx.insert(schema.timeCategories).values({
          id: newId("tcat"),
          tenantId,
          name,
          color,
          billable,
        });
      }

      // 6. Wage groups
      for (const [name, rate, cost] of [
        ["Geselle", 78, 28],
        ["Meister", 95, 38],
        ["Lehrling", 42, 16],
      ] as const) {
        await tx.insert(schema.wageGroups).values({
          id: newId("wgr"),
          tenantId,
          name,
          hourlyRate: String(rate),
          hourlyCost: String(cost),
        });
      }

      // 7. Default email template
      await tx.insert(schema.emailTemplates).values({
        id: newId("etpl"),
        tenantId,
        name: "Standard Angebot",
        context: "quote_send",
        subject: "Ihr Angebot {{Document.number}} von {{Company.name}}",
        bodyText:
          "Sehr geehrte/r {{Contact.salutation}} {{Contact.lastName}},\n\n" +
          "im Anhang finden Sie unser Angebot {{Document.number}} vom {{Document.date}}.\n" +
          "Bei Fragen stehen wir gerne zur Verfügung.\n\n" +
          "Mit besten Grüßen\n{{User.name}}\n{{Company.name}}",
        variables: ["Contact.salutation", "Contact.lastName", "Document.number", "Document.date", "User.name", "Company.name"],
        isDefault: true,
      });

      // 8. Welcome logbook event (no entity yet — skip)
    });

    return { tenantId, userId, slug, email: input.email };
  }),

  /** Returns true if a slug/email is available (used in signup form for live validation). */
  checkAvailability: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const [u] = await ctx.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, input.email))
        .limit(1);
      return { emailAvailable: !u };
    }),
});

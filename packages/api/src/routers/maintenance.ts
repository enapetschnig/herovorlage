import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, ilike, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M3_MAINTENANCE;

// -----------------------------------------------------------------------------
// Zod schemas
// -----------------------------------------------------------------------------
const assetCreate = z.object({
  contactId: z.string(),
  projectId: z.string().optional(),
  assetType: z.enum(["heat_pump", "buffer", "dhw", "pv", "meter", "boiler", "other"]),
  brand: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  serialNumber: z.string().max(120).optional(),
  installationDate: z.string().date().optional(),
  warrantyUntil: z.string().date().optional(),
  locationDescription: z.string().max(500).optional(),
  powerKw: z.number().min(0).max(9999).optional(),
  cop: z.number().min(0).max(20).optional(),
  refrigerant: z.string().max(40).optional(),
  soundLevelDb: z.number().min(0).max(200).optional(),
});

const contractCreate = z.object({
  contactId: z.string(),
  assetId: z.string().optional(),
  name: z.string().min(1).max(200),
  intervalMonths: z.number().int().min(1).max(120).default(12),
  nextDueDate: z.string().date().optional(),
  price: z.number().min(0).default(0),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  autoRenewal: z.boolean().default(true),
});

const visitComplete = z.object({
  id: z.string(),
  protocol: z.record(z.unknown()).default({}),
  issuesFound: z.string().max(4000).optional(),
  followUpRequired: z.boolean().default(false),
});

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------
export const maintenanceRouter = router({
  // ---- Contracts ----
  contractsList: moduleProcedure(M)
    .input(
      z.object({
        search: z.string().trim().optional(),
        dueWithinDays: z.number().int().positive().max(365).optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const c = schema.maintenanceContracts;
      const filters = [eq(c.tenantId, ctx.tenantId), isNull(c.deletedAt)];
      if (input.search) filters.push(ilike(c.name, `%${input.search}%`));
      if (input.dueWithinDays) {
        const until = new Date();
        until.setDate(until.getDate() + input.dueWithinDays);
        filters.push(lte(c.nextDueDate, until.toISOString().slice(0, 10)));
      }
      const offset = (input.page - 1) * input.pageSize;
      return ctx.db
        .select({
          id: c.id, name: c.name, intervalMonths: c.intervalMonths, nextDueDate: c.nextDueDate,
          price: c.price, startDate: c.startDate, endDate: c.endDate, autoRenewal: c.autoRenewal,
          contactId: c.contactId,
          contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
          assetId: c.assetId,
          assetLabel: sql<string | null>`nullif(concat_ws(' ', ${schema.assets.brand}, ${schema.assets.model}), '')`,
        })
        .from(c)
        .leftJoin(schema.contacts, eq(schema.contacts.id, c.contactId))
        .leftJoin(schema.assets, eq(schema.assets.id, c.assetId))
        .where(and(...filters))
        .orderBy(asc(c.nextDueDate))
        .limit(input.pageSize)
        .offset(offset);
    }),

  contractById: moduleProcedure(M)
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [contract] = await ctx.db
        .select()
        .from(schema.maintenanceContracts)
        .where(
          and(
            eq(schema.maintenanceContracts.id, input.id),
            eq(schema.maintenanceContracts.tenantId, ctx.tenantId),
            isNull(schema.maintenanceContracts.deletedAt),
          ),
        )
        .limit(1);
      if (!contract) throw new TRPCError({ code: "NOT_FOUND" });

      const [contact, asset, visits] = await Promise.all([
        ctx.db.select().from(schema.contacts).where(eq(schema.contacts.id, contract.contactId)).limit(1),
        contract.assetId
          ? ctx.db.select().from(schema.assets).where(eq(schema.assets.id, contract.assetId)).limit(1)
          : Promise.resolve([]),
        ctx.db
          .select({
            id: schema.maintenanceVisits.id,
            scheduledAt: schema.maintenanceVisits.scheduledAt,
            completedAt: schema.maintenanceVisits.completedAt,
            technicianUserId: schema.maintenanceVisits.technicianUserId,
            technicianName: schema.users.name,
            issuesFound: schema.maintenanceVisits.issuesFound,
            followUpRequired: schema.maintenanceVisits.followUpRequired,
            protocol: schema.maintenanceVisits.protocol,
          })
          .from(schema.maintenanceVisits)
          .leftJoin(schema.users, eq(schema.users.id, schema.maintenanceVisits.technicianUserId))
          .where(eq(schema.maintenanceVisits.contractId, contract.id))
          .orderBy(desc(schema.maintenanceVisits.scheduledAt)),
      ]);

      return { ...contract, contact: contact[0] ?? null, asset: asset[0] ?? null, visits };
    }),

  createContract: moduleProcedure(M)
    .input(contractCreate)
    .mutation(async ({ ctx, input }) => {
      const id = idFor.maintenanceContract();
      await ctx.db.insert(schema.maintenanceContracts).values({
        id,
        tenantId: ctx.tenantId,
        contactId: input.contactId,
        assetId: input.assetId ?? null,
        name: input.name,
        intervalMonths: input.intervalMonths,
        nextDueDate: input.nextDueDate ?? null,
        price: String(input.price),
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        autoRenewal: input.autoRenewal,
      });

      // If due date given, create the first scheduled visit automatically
      if (input.nextDueDate) {
        await ctx.db.insert(schema.maintenanceVisits).values({
          id: idFor.maintenanceVisit(),
          tenantId: ctx.tenantId,
          contractId: id,
          scheduledAt: new Date(input.nextDueDate + "T09:00:00.000Z"),
          protocol: {},
          followUpRequired: false,
        });
      }

      return { id };
    }),

  // ---- Visits ----
  upcomingVisits: moduleProcedure(M)
    .input(z.object({ days: z.number().int().positive().max(365).default(60) }))
    .query(async ({ ctx, input }) => {
      const until = new Date();
      until.setDate(until.getDate() + input.days);
      return ctx.db
        .select({
          id: schema.maintenanceVisits.id,
          scheduledAt: schema.maintenanceVisits.scheduledAt,
          completedAt: schema.maintenanceVisits.completedAt,
          contractId: schema.maintenanceVisits.contractId,
          contractName: schema.maintenanceContracts.name,
          contactId: schema.maintenanceContracts.contactId,
          contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
          technicianName: schema.users.name,
        })
        .from(schema.maintenanceVisits)
        .leftJoin(schema.maintenanceContracts, eq(schema.maintenanceContracts.id, schema.maintenanceVisits.contractId))
        .leftJoin(schema.contacts, eq(schema.contacts.id, schema.maintenanceContracts.contactId))
        .leftJoin(schema.users, eq(schema.users.id, schema.maintenanceVisits.technicianUserId))
        .where(
          and(
            eq(schema.maintenanceVisits.tenantId, ctx.tenantId),
            isNull(schema.maintenanceVisits.completedAt),
            isNull(schema.maintenanceVisits.deletedAt),
            lte(schema.maintenanceVisits.scheduledAt, until),
          ),
        )
        .orderBy(asc(schema.maintenanceVisits.scheduledAt));
    }),

  completeVisit: moduleProcedure(M)
    .input(visitComplete)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ contractId: schema.maintenanceVisits.contractId })
        .from(schema.maintenanceVisits)
        .where(and(
          eq(schema.maintenanceVisits.id, input.id),
          eq(schema.maintenanceVisits.tenantId, ctx.tenantId),
        ))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(schema.maintenanceVisits)
        .set({
          completedAt: new Date(),
          technicianUserId: ctx.userId,
          protocol: input.protocol,
          issuesFound: input.issuesFound ?? null,
          followUpRequired: input.followUpRequired,
        })
        .where(eq(schema.maintenanceVisits.id, input.id));

      // Roll next_due_date forward by interval_months and create the next visit
      const [contract] = await ctx.db
        .select({ intervalMonths: schema.maintenanceContracts.intervalMonths, nextDueDate: schema.maintenanceContracts.nextDueDate })
        .from(schema.maintenanceContracts)
        .where(eq(schema.maintenanceContracts.id, existing.contractId))
        .limit(1);
      if (contract?.nextDueDate) {
        const nextDue = addMonths(new Date(contract.nextDueDate), contract.intervalMonths);
        await ctx.db
          .update(schema.maintenanceContracts)
          .set({ nextDueDate: nextDue.toISOString().slice(0, 10) })
          .where(eq(schema.maintenanceContracts.id, existing.contractId));
        await ctx.db.insert(schema.maintenanceVisits).values({
          id: idFor.maintenanceVisit(),
          tenantId: ctx.tenantId,
          contractId: existing.contractId,
          scheduledAt: new Date(nextDue.toISOString().slice(0, 10) + "T09:00:00.000Z"),
          protocol: {},
          followUpRequired: false,
        });
      }

      // Logbook
      await ctx.db.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: "contact",
        entityId: (await ctx.db
          .select({ id: schema.maintenanceContracts.contactId })
          .from(schema.maintenanceContracts)
          .where(eq(schema.maintenanceContracts.id, existing.contractId))
          .limit(1))[0]?.id ?? "",
        kind: "event",
        message: `Wartungstermin abgeschlossen${input.issuesFound ? ` — Mängel: ${input.issuesFound}` : "."}`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { id: input.id };
    }),

  // ---- Assets ----
  listAssetsByContact: moduleProcedure(M)
    .input(z.object({ contactId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(schema.assets)
        .where(
          and(
            eq(schema.assets.tenantId, ctx.tenantId),
            eq(schema.assets.contactId, input.contactId),
            isNull(schema.assets.deletedAt),
          ),
        )
        .orderBy(desc(schema.assets.installationDate));
    }),

  createAsset: moduleProcedure(M)
    .input(assetCreate)
    .mutation(async ({ ctx, input }) => {
      const id = idFor.asset();
      await ctx.db.insert(schema.assets).values({
        id,
        tenantId: ctx.tenantId,
        contactId: input.contactId,
        projectId: input.projectId ?? null,
        assetType: input.assetType,
        brand: input.brand ?? null,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        installationDate: input.installationDate ?? null,
        warrantyUntil: input.warrantyUntil ?? null,
        locationDescription: input.locationDescription ?? null,
        powerKw: input.powerKw !== undefined ? String(input.powerKw) : null,
        cop: input.cop !== undefined ? String(input.cop) : null,
        refrigerant: input.refrigerant ?? null,
        soundLevelDb: input.soundLevelDb !== undefined ? String(input.soundLevelDb) : null,
      });
      return { id };
    }),

  removeAsset: moduleProcedure(M)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.assets)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.assets.id, input.id), eq(schema.assets.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),

  /** KPIs + counts for the maintenance dashboard. */
  dashboard: moduleProcedure(M).query(async ({ ctx }) => {
    const today = new Date();
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(today); in60.setDate(in60.getDate() + 60);

    const [contracts, overdue, next30, next60, totalAssets] = await Promise.all([
      ctx.db
        .select({ c: sql<string>`count(*)` })
        .from(schema.maintenanceContracts)
        .where(and(eq(schema.maintenanceContracts.tenantId, ctx.tenantId), isNull(schema.maintenanceContracts.deletedAt))),
      ctx.db
        .select({ c: sql<string>`count(*)` })
        .from(schema.maintenanceVisits)
        .where(and(
          eq(schema.maintenanceVisits.tenantId, ctx.tenantId),
          isNull(schema.maintenanceVisits.completedAt),
          isNull(schema.maintenanceVisits.deletedAt),
          lt(schema.maintenanceVisits.scheduledAt, today),
        )),
      ctx.db
        .select({ c: sql<string>`count(*)` })
        .from(schema.maintenanceVisits)
        .where(and(
          eq(schema.maintenanceVisits.tenantId, ctx.tenantId),
          isNull(schema.maintenanceVisits.completedAt),
          isNull(schema.maintenanceVisits.deletedAt),
          gte(schema.maintenanceVisits.scheduledAt, today),
          lt(schema.maintenanceVisits.scheduledAt, in30),
        )),
      ctx.db
        .select({ c: sql<string>`count(*)` })
        .from(schema.maintenanceVisits)
        .where(and(
          eq(schema.maintenanceVisits.tenantId, ctx.tenantId),
          isNull(schema.maintenanceVisits.completedAt),
          isNull(schema.maintenanceVisits.deletedAt),
          gte(schema.maintenanceVisits.scheduledAt, in30),
          lt(schema.maintenanceVisits.scheduledAt, in60),
        )),
      ctx.db
        .select({ c: sql<string>`count(*)` })
        .from(schema.assets)
        .where(and(eq(schema.assets.tenantId, ctx.tenantId), isNull(schema.assets.deletedAt))),
    ]);

    return {
      contracts: Number(contracts[0]?.c ?? 0),
      overdue: Number(overdue[0]?.c ?? 0),
      next30Days: Number(next30[0]?.c ?? 0),
      next60Days: Number(next60[0]?.c ?? 0),
      totalAssets: Number(totalAssets[0]?.c ?? 0),
    };
  }),
});

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

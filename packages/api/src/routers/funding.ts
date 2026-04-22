import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { FEATURES } from "@heatflow/utils/constants";
import { idFor } from "@heatflow/utils/ids";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M7_FUNDING;

const APPLICATION_STATUSES = ["draft", "submitted", "approved", "rejected", "paid"] as const;

export const fundingRouter = router({
  /** Available funding programs filtered by tenant country (active only). */
  programs: moduleProcedure(M).query(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .select({ country: schema.tenants.country })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, ctx.tenantId))
      .limit(1);

    const country = tenant?.country ?? "AT";

    return ctx.db
      .select()
      .from(schema.fundingPrograms)
      .where(
        and(
          eq(schema.fundingPrograms.active, true),
          isNull(schema.fundingPrograms.deletedAt),
          eq(schema.fundingPrograms.country, country),
        ),
      )
      .orderBy(desc(schema.fundingPrograms.maxAmount));
  }),

  /** All applications across all projects, with joined project + program info. */
  applicationsList: moduleProcedure(M)
    .input(z.object({ status: z.enum(APPLICATION_STATUSES).optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(schema.fundingApplications.tenantId, ctx.tenantId),
        isNull(schema.fundingApplications.deletedAt),
      ];
      if (input.status) filters.push(eq(schema.fundingApplications.status, input.status));
      return ctx.db
        .select({
          id: schema.fundingApplications.id,
          status: schema.fundingApplications.status,
          amountRequested: schema.fundingApplications.amountRequested,
          amountApproved: schema.fundingApplications.amountApproved,
          submittedAt: schema.fundingApplications.submittedAt,
          approvedAt: schema.fundingApplications.approvedAt,
          paidAt: schema.fundingApplications.paidAt,
          notes: schema.fundingApplications.notes,
          projectId: schema.fundingApplications.projectId,
          projectTitle: schema.projects.title,
          projectNumber: schema.projects.number,
          programId: schema.fundingApplications.programId,
          programName: schema.fundingPrograms.name,
          programCountry: schema.fundingPrograms.country,
        })
        .from(schema.fundingApplications)
        .leftJoin(schema.projects, eq(schema.projects.id, schema.fundingApplications.projectId))
        .leftJoin(schema.fundingPrograms, eq(schema.fundingPrograms.id, schema.fundingApplications.programId))
        .where(and(...filters))
        .orderBy(desc(schema.fundingApplications.updatedAt));
    }),

  /** Applications for a single project — used on the project-detail funding card. */
  byProject: moduleProcedure(M)
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: schema.fundingApplications.id,
          status: schema.fundingApplications.status,
          amountRequested: schema.fundingApplications.amountRequested,
          amountApproved: schema.fundingApplications.amountApproved,
          submittedAt: schema.fundingApplications.submittedAt,
          approvedAt: schema.fundingApplications.approvedAt,
          paidAt: schema.fundingApplications.paidAt,
          notes: schema.fundingApplications.notes,
          programId: schema.fundingApplications.programId,
          programName: schema.fundingPrograms.name,
          programMaxAmount: schema.fundingPrograms.maxAmount,
        })
        .from(schema.fundingApplications)
        .leftJoin(schema.fundingPrograms, eq(schema.fundingPrograms.id, schema.fundingApplications.programId))
        .where(
          and(
            eq(schema.fundingApplications.tenantId, ctx.tenantId),
            eq(schema.fundingApplications.projectId, input.projectId),
            isNull(schema.fundingApplications.deletedAt),
          ),
        )
        .orderBy(desc(schema.fundingApplications.updatedAt));
    }),

  createApplication: moduleProcedure(M)
    .input(
      z.object({
        projectId: z.string(),
        programId: z.string(),
        amountRequested: z.number().min(0),
        notes: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = idFor.fundingApplication();
      await ctx.db.insert(schema.fundingApplications).values({
        id,
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        programId: input.programId,
        status: "draft",
        amountRequested: String(input.amountRequested),
        notes: input.notes ?? null,
      });

      await ctx.db.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: "project",
        entityId: input.projectId,
        kind: "event",
        message: `Förderantrag angelegt (angefragt: €${input.amountRequested.toFixed(2)}).`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });
      return { id };
    }),

  updateStatus: moduleProcedure(M)
    .input(
      z.object({
        id: z.string(),
        status: z.enum(APPLICATION_STATUSES),
        amountApproved: z.number().min(0).optional(),
        notes: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Record<string, unknown> = { status: input.status };
      const now = new Date();
      if (input.status === "submitted") patch.submittedAt = now;
      if (input.status === "approved") { patch.approvedAt = now; if (input.amountApproved !== undefined) patch.amountApproved = String(input.amountApproved); }
      if (input.status === "rejected") patch.approvedAt = now;
      if (input.status === "paid") patch.paidAt = now;
      if (input.notes !== undefined) patch.notes = input.notes;

      await ctx.db
        .update(schema.fundingApplications)
        .set(patch)
        .where(and(eq(schema.fundingApplications.id, input.id), eq(schema.fundingApplications.tenantId, ctx.tenantId)));

      const [app] = await ctx.db
        .select({ projectId: schema.fundingApplications.projectId })
        .from(schema.fundingApplications)
        .where(eq(schema.fundingApplications.id, input.id))
        .limit(1);
      if (app) {
        await ctx.db.insert(schema.logbookEntries).values({
          id: idFor.logbookEntry(),
          tenantId: ctx.tenantId,
          entityType: "project",
          entityId: app.projectId,
          kind: "event",
          message: `Förderantrag-Status auf „${input.status}" gesetzt${input.amountApproved !== undefined ? ` (bewilligt: €${input.amountApproved.toFixed(2)})` : ""}.`,
          authorUserId: ctx.userId,
          isSystemEvent: true,
        });
      }

      return { id: input.id };
    }),

  remove: moduleProcedure(M)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.fundingApplications)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.fundingApplications.id, input.id), eq(schema.fundingApplications.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),
});

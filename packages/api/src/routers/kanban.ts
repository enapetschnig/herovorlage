import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES, PROJECT_STATUSES, type ProjectStatus } from "@heatflow/utils/constants";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M14_KANBAN;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  lead: "Lead",
  quoted: "Angebot",
  accepted: "Angenommen",
  scheduled: "Geplant",
  in_progress: "In Arbeit",
  completed: "Fertig",
  invoiced: "Fakturiert",
  paid: "Bezahlt",
  cancelled: "Storniert",
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  lead: "#94a3b8",
  quoted: "#3b82f6",
  accepted: "#0ea5e9",
  scheduled: "#8b5cf6",
  in_progress: "#f59e0b",
  completed: "#10b981",
  invoiced: "#6366f1",
  paid: "#16a34a",
  cancelled: "#94a3b8",
};

/** Active workflow lanes — `paid` and `cancelled` end-states off-board by default. */
const DEFAULT_LANES: ProjectStatus[] = ["lead", "quoted", "accepted", "scheduled", "in_progress", "completed", "invoiced"];

export const kanbanRouter = router({
  /** Returns all active projects grouped into status lanes for the Kanban board. */
  board: moduleProcedure(M)
    .input(z.object({ trade: z.string().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(schema.projects.tenantId, ctx.tenantId),
        isNull(schema.projects.deletedAt),
        sql`${schema.projects.status} = ANY(${DEFAULT_LANES})`,
      ];
      if (input.trade) filters.push(eq(schema.projects.trade, input.trade));

      const rows = await ctx.db
        .select({
          id: schema.projects.id,
          number: schema.projects.number,
          title: schema.projects.title,
          status: schema.projects.status,
          potentialValue: schema.projects.potentialValue,
          contactId: schema.projects.contactId,
          contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
          responsibleUserId: schema.projects.responsibleUserId,
          responsibleUserName: schema.users.name,
          startDate: schema.projects.startDate,
          updatedAt: schema.projects.updatedAt,
        })
        .from(schema.projects)
        .leftJoin(schema.contacts, eq(schema.contacts.id, schema.projects.contactId))
        .leftJoin(schema.users, eq(schema.users.id, schema.projects.responsibleUserId))
        .where(and(...filters));

      // Build lanes
      const lanes = DEFAULT_LANES.map((status) => ({
        id: status,
        label: STATUS_LABEL[status],
        color: STATUS_COLOR[status],
        cards: rows.filter((r) => r.status === status).map((r) => ({
          ...r,
          potentialValue: r.potentialValue ? Number(r.potentialValue) : 0,
        })),
        valueSum: rows.filter((r) => r.status === status).reduce((s, r) => s + (r.potentialValue ? Number(r.potentialValue) : 0), 0),
      }));

      return { lanes };
    }),

  /** Move a project to another lane (= update its status). Logs the change. */
  moveCard: moduleProcedure(M)
    .input(z.object({ projectId: z.string(), toStatus: z.enum(PROJECT_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ status: schema.projects.status, title: schema.projects.title })
        .from(schema.projects)
        .where(and(eq(schema.projects.id, input.projectId), eq(schema.projects.tenantId, ctx.tenantId)))
        .limit(1);
      if (!existing || existing.status === input.toStatus) return { id: input.projectId };

      await ctx.db
        .update(schema.projects)
        .set({ status: input.toStatus })
        .where(and(eq(schema.projects.id, input.projectId), eq(schema.projects.tenantId, ctx.tenantId)));

      await ctx.db.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: "project",
        entityId: input.projectId,
        kind: "system",
        message: `Status auf „${STATUS_LABEL[input.toStatus]}" geändert (Kanban).`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { id: input.projectId };
    }),
});

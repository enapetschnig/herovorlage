import { moduleProcedure, router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M4_PLANNING;

const SLOT_TYPE = z.enum(["task", "maintenance"]);

/**
 * The Plantafel ("schedule") is a per-day, per-user grid of work items.
 * Two source tables feed it:
 *   - tasks (assigned_user_id + due_date)            → tasks bookings
 *   - maintenance_visits (technician_user_id + scheduled_at) → maintenance bookings
 * Drag-and-drop lets you reassign user / date in either source.
 */
export const scheduleRouter = router({
  /** Returns all bookings for a date range, grouped by user + day. */
  forRange: moduleProcedure(M)
    .input(z.object({ fromDate: z.string().date(), toDate: z.string().date() }))
    .query(async ({ ctx, input }) => {
      const fromTs = new Date(input.fromDate + "T00:00:00.000Z");
      const toTsExcl = new Date(input.toDate + "T00:00:00.000Z");
      toTsExcl.setUTCDate(toTsExcl.getUTCDate() + 1);

      const [tasks, visits, members] = await Promise.all([
        ctx.db
          .select({
            id: schema.tasks.id,
            title: schema.tasks.title,
            dueDate: schema.tasks.dueDate,
            priority: schema.tasks.priority,
            status: schema.tasks.status,
            assignedUserId: schema.tasks.assignedUserId,
            projectId: schema.tasks.projectId,
            projectTitle: schema.projects.title,
            projectNumber: schema.projects.number,
          })
          .from(schema.tasks)
          .leftJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
          .where(
            and(
              eq(schema.tasks.tenantId, ctx.tenantId),
              isNull(schema.tasks.deletedAt),
              sql`${schema.tasks.status} in ('open','in_progress')`,
              gte(schema.tasks.dueDate, input.fromDate),
              lte(schema.tasks.dueDate, input.toDate),
            ),
          ),
        ctx.db
          .select({
            id: schema.maintenanceVisits.id,
            scheduledAt: schema.maintenanceVisits.scheduledAt,
            completedAt: schema.maintenanceVisits.completedAt,
            technicianUserId: schema.maintenanceVisits.technicianUserId,
            contractId: schema.maintenanceVisits.contractId,
            contractName: schema.maintenanceContracts.name,
            contactId: schema.maintenanceContracts.contactId,
            contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
          })
          .from(schema.maintenanceVisits)
          .leftJoin(schema.maintenanceContracts, eq(schema.maintenanceContracts.id, schema.maintenanceVisits.contractId))
          .leftJoin(schema.contacts, eq(schema.contacts.id, schema.maintenanceContracts.contactId))
          .where(
            and(
              eq(schema.maintenanceVisits.tenantId, ctx.tenantId),
              isNull(schema.maintenanceVisits.deletedAt),
              gte(schema.maintenanceVisits.scheduledAt, fromTs),
              lte(schema.maintenanceVisits.scheduledAt, toTsExcl),
            ),
          ),
        ctx.db
          .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role })
          .from(schema.users)
          .where(and(eq(schema.users.tenantId, ctx.tenantId), eq(schema.users.active, true), isNull(schema.users.deletedAt)))
          .orderBy(schema.users.name),
      ]);

      type Slot = {
        id: string;
        kind: "task" | "maintenance";
        title: string;
        date: string;        // YYYY-MM-DD
        userId: string | null;
        sub: string | null;  // project number or contact name
        priority?: string | null;
        status?: string | null;
        completed?: boolean;
        href: string;
      };

      const slots: Slot[] = [];

      for (const t of tasks) {
        slots.push({
          id: t.id,
          kind: "task",
          title: t.title,
          date: typeof t.dueDate === "string" ? t.dueDate : (t.dueDate as unknown as Date).toISOString().slice(0, 10),
          userId: t.assignedUserId,
          sub: t.projectNumber ?? t.projectTitle,
          priority: t.priority,
          status: t.status,
          href: t.projectId ? `/projects/${t.projectId}` : "/tasks",
        });
      }

      for (const v of visits) {
        slots.push({
          id: v.id,
          kind: "maintenance",
          title: `Wartung: ${v.contractName ?? "Unbekannt"}`,
          date: (v.scheduledAt as Date).toISOString().slice(0, 10),
          userId: v.technicianUserId,
          sub: v.contactName ?? null,
          completed: !!v.completedAt,
          href: `/maintenance/${v.contractId}`,
        });
      }

      return { slots, members };
    }),

  /** Reassign a task or maintenance visit to a new user/date. */
  moveSlot: moduleProcedure(M)
    .input(
      z.object({
        kind: SLOT_TYPE,
        id: z.string(),
        toUserId: z.string().nullable(),
        toDate: z.string().date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.kind === "task") {
        await ctx.db
          .update(schema.tasks)
          .set({ assignedUserId: input.toUserId, dueDate: input.toDate })
          .where(and(eq(schema.tasks.id, input.id), eq(schema.tasks.tenantId, ctx.tenantId)));
      } else {
        // Keep the time-of-day, change the date
        const [existing] = await ctx.db
          .select({ scheduledAt: schema.maintenanceVisits.scheduledAt })
          .from(schema.maintenanceVisits)
          .where(and(eq(schema.maintenanceVisits.id, input.id), eq(schema.maintenanceVisits.tenantId, ctx.tenantId)))
          .limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const oldHm = (existing.scheduledAt as Date).toISOString().slice(11, 19);
        const newAt = new Date(`${input.toDate}T${oldHm}.000Z`);
        await ctx.db
          .update(schema.maintenanceVisits)
          .set({ scheduledAt: newAt, technicianUserId: input.toUserId })
          .where(and(eq(schema.maintenanceVisits.id, input.id), eq(schema.maintenanceVisits.tenantId, ctx.tenantId)));
      }
      return { id: input.id };
    }),
});

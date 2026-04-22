import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

export const dashboardRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    const [
      [contactsCount],
      [projectsActive],
      [openTasks],
      [overdueInvoices],
      pipeline,
      recentLogbook,
      myTasks,
    ] = await Promise.all([
      ctx.db.select({ c: count() }).from(schema.contacts)
        .where(and(eq(schema.contacts.tenantId, ctx.tenantId), isNull(schema.contacts.deletedAt))),
      ctx.db.select({ c: count() }).from(schema.projects)
        .where(and(
          eq(schema.projects.tenantId, ctx.tenantId),
          isNull(schema.projects.deletedAt),
          sql`${schema.projects.status} not in ('completed','paid','cancelled')`,
        )),
      ctx.db.select({ c: count() }).from(schema.tasks)
        .where(and(
          eq(schema.tasks.tenantId, ctx.tenantId),
          isNull(schema.tasks.deletedAt),
          sql`${schema.tasks.status} in ('open','in_progress')`,
        )),
      ctx.db.select({ c: count() }).from(schema.documents)
        .where(and(
          eq(schema.documents.tenantId, ctx.tenantId),
          isNull(schema.documents.deletedAt),
          eq(schema.documents.status, "overdue"),
        )),
      ctx.db
        .select({
          status: schema.projects.status,
          c: count(),
          v: sql<string | null>`coalesce(sum(${schema.projects.potentialValue}), 0)`,
        })
        .from(schema.projects)
        .where(and(eq(schema.projects.tenantId, ctx.tenantId), isNull(schema.projects.deletedAt)))
        .groupBy(schema.projects.status),
      ctx.db
        .select({
          id: schema.logbookEntries.id,
          kind: schema.logbookEntries.kind,
          message: schema.logbookEntries.message,
          occurredAt: schema.logbookEntries.occurredAt,
          entityType: schema.logbookEntries.entityType,
          entityId: schema.logbookEntries.entityId,
          authorName: schema.users.name,
        })
        .from(schema.logbookEntries)
        .leftJoin(schema.users, eq(schema.users.id, schema.logbookEntries.authorUserId))
        .where(and(eq(schema.logbookEntries.tenantId, ctx.tenantId), isNull(schema.logbookEntries.deletedAt)))
        .orderBy(desc(schema.logbookEntries.occurredAt))
        .limit(15),
      ctx.db
        .select({
          id: schema.tasks.id,
          title: schema.tasks.title,
          dueDate: schema.tasks.dueDate,
          priority: schema.tasks.priority,
          projectId: schema.tasks.projectId,
          projectTitle: schema.projects.title,
        })
        .from(schema.tasks)
        .leftJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
        .where(
          and(
            eq(schema.tasks.tenantId, ctx.tenantId),
            isNull(schema.tasks.deletedAt),
            eq(schema.tasks.assignedUserId, ctx.userId),
            sql`${schema.tasks.status} in ('open','in_progress')`,
          ),
        )
        .orderBy(schema.tasks.dueDate)
        .limit(10),
    ]);

    return {
      kpis: {
        contacts: Number(contactsCount?.c ?? 0),
        activeProjects: Number(projectsActive?.c ?? 0),
        openTasks: Number(openTasks?.c ?? 0),
        overdueInvoices: Number(overdueInvoices?.c ?? 0),
      },
      pipeline: pipeline.map((p) => ({
        status: p.status,
        count: Number(p.c ?? 0),
        potentialValue: p.v ? Number(p.v) : 0,
      })),
      recentLogbook,
      myTasks,
    };
  }),
});

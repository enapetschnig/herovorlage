import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { taskCreateSchema, taskListInput, taskUpdateSchema } from "@heatflow/schemas";
import { idFor } from "@heatflow/utils/ids";
import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { z } from "zod";

export const tasksRouter = router({
  list: protectedProcedure.input(taskListInput).query(async ({ ctx, input }) => {
    const { page, pageSize, search, status, projectId, assignedUserId } = input;
    const offset = (page - 1) * pageSize;
    const t = schema.tasks;
    const filters = [eq(t.tenantId, ctx.tenantId), isNull(t.deletedAt)];
    if (status) filters.push(eq(t.status, status));
    if (projectId) filters.push(eq(t.projectId, projectId));
    if (assignedUserId) filters.push(eq(t.assignedUserId, assignedUserId));
    if (search) filters.push(ilike(t.title, `%${search}%`));

    const [items, [{ total }]] = await Promise.all([
      ctx.db.select().from(t).where(and(...filters))
        .orderBy(asc(t.dueDate), desc(t.createdAt))
        .limit(pageSize)
        .offset(offset),
      ctx.db.select({ total: count() }).from(t).where(and(...filters)),
    ]);
    return { items, total: Number(total ?? 0), page, pageSize };
  }),

  create: protectedProcedure.input(taskCreateSchema).mutation(async ({ ctx, input }) => {
    const id = idFor.task();
    await ctx.db.insert(schema.tasks).values({
      id,
      tenantId: ctx.tenantId,
      projectId: input.projectId ?? null,
      contactId: input.contactId ?? null,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      assignedUserId: input.assignedUserId ?? null,
      status: input.status,
      priority: input.priority,
    });
    return { id };
  }),

  update: protectedProcedure.input(taskUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    await ctx.db
      .update(schema.tasks)
      .set(patch)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.tenantId, ctx.tenantId)));
    return { id };
  }),

  toggleDone: protectedProcedure
    .input(z.object({ id: z.string(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.tasks)
        .set({
          status: input.done ? "done" : "open",
          completedAt: input.done ? new Date().toISOString() : null,
        })
        .where(and(eq(schema.tasks.id, input.id), eq(schema.tasks.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.tasks.id, input.id), eq(schema.tasks.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),
});

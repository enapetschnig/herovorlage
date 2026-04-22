import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { projectCreateSchema, projectListInput, projectStatusChangeInput, projectUpdateSchema } from "@heatflow/schemas";
import { idFor } from "@heatflow/utils/ids";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

export const projectsRouter = router({
  list: protectedProcedure.input(projectListInput).query(async ({ ctx, input }) => {
    const { page, pageSize, search, status, contactId, sortBy, sortDir } = input;
    const offset = (page - 1) * pageSize;
    const p = schema.projects;
    const filters = [eq(p.tenantId, ctx.tenantId), isNull(p.deletedAt)];
    if (status) filters.push(eq(p.status, status));
    if (contactId) filters.push(eq(p.contactId, contactId));
    if (search) {
      const s = `%${search}%`;
      const or_ = or(ilike(p.title, s), ilike(p.number, s));
      if (or_) filters.push(or_);
    }
    const orderCol = sortBy === "title" ? p.title : sortBy === "number" ? p.number : p.createdAt;
    const order = sortDir === "asc" ? asc(orderCol) : desc(orderCol);

    const [items, [{ total }]] = await Promise.all([
      ctx.db
        .select({
          id: p.id,
          number: p.number,
          title: p.title,
          status: p.status,
          potentialValue: p.potentialValue,
          startDate: p.startDate,
          endDate: p.endDate,
          createdAt: p.createdAt,
          contactId: p.contactId,
          contactName: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
          responsibleUserId: p.responsibleUserId,
          responsibleUserName: schema.users.name,
        })
        .from(p)
        .leftJoin(schema.contacts, eq(schema.contacts.id, p.contactId))
        .leftJoin(schema.users, eq(schema.users.id, p.responsibleUserId))
        .where(and(...filters))
        .orderBy(order)
        .limit(pageSize)
        .offset(offset),
      ctx.db.select({ total: count() }).from(p).where(and(...filters)),
    ]);

    return { items, total: Number(total ?? 0), page, pageSize };
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [proj] = await ctx.db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.id, input.id),
          eq(schema.projects.tenantId, ctx.tenantId),
          isNull(schema.projects.deletedAt),
        ),
      )
      .limit(1);
    if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

    const [contact] = await ctx.db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, proj.contactId))
      .limit(1);

    const [tasks, documents, logbook, files, calc] = await Promise.all([
      ctx.db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.projectId, proj.id),
            eq(schema.tasks.tenantId, ctx.tenantId),
            isNull(schema.tasks.deletedAt),
          ),
        )
        .orderBy(asc(schema.tasks.dueDate)),
      ctx.db
        .select({
          id: schema.documents.id,
          number: schema.documents.number,
          type: schema.documents.type,
          title: schema.documents.title,
          status: schema.documents.status,
          documentDate: schema.documents.documentDate,
          totalGross: schema.documents.totalGross,
        })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.projectId, proj.id),
            eq(schema.documents.tenantId, ctx.tenantId),
            isNull(schema.documents.deletedAt),
          ),
        )
        .orderBy(desc(schema.documents.documentDate)),
      ctx.db
        .select()
        .from(schema.logbookEntries)
        .where(
          and(
            eq(schema.logbookEntries.entityType, "project"),
            eq(schema.logbookEntries.entityId, proj.id),
            eq(schema.logbookEntries.tenantId, ctx.tenantId),
            isNull(schema.logbookEntries.deletedAt),
          ),
        )
        .orderBy(desc(schema.logbookEntries.occurredAt))
        .limit(50),
      ctx.db
        .select()
        .from(schema.files)
        .where(
          and(
            eq(schema.files.projectId, proj.id),
            eq(schema.files.tenantId, ctx.tenantId),
            isNull(schema.files.deletedAt),
          ),
        )
        .orderBy(desc(schema.files.createdAt)),
      ctx.db
        .select()
        .from(schema.projectCalculations)
        .where(eq(schema.projectCalculations.projectId, proj.id))
        .limit(1),
    ]);

    return { ...proj, contact: contact ?? null, tasks, documents, logbook, files, calculation: calc[0] ?? null };
  }),

  create: protectedProcedure.input(projectCreateSchema).mutation(async ({ ctx, input }) => {
    const id = idFor.project();
    const number = await nextProjectNumber(ctx.db, ctx.tenantId);

    await ctx.db.insert(schema.projects).values({
      id,
      tenantId: ctx.tenantId,
      number,
      title: input.title,
      status: input.status,
      contactId: input.contactId,
      addressId: input.addressId ?? null,
      projectTypeId: input.projectTypeId ?? null,
      trade: input.trade ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      potentialValue: input.potentialValue !== undefined ? String(input.potentialValue) : null,
      source: input.source ?? null,
      description: input.description ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
    });

    await ctx.db.insert(schema.logbookEntries).values({
      id: idFor.logbookEntry(),
      tenantId: ctx.tenantId,
      entityType: "project",
      entityId: id,
      kind: "system",
      message: `Projekt "${input.title}" angelegt.`,
      authorUserId: ctx.userId,
      isSystemEvent: true,
    });

    return { id, number };
  }),

  update: protectedProcedure.input(projectUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (patch.potentialValue !== undefined) patch.potentialValue = String(patch.potentialValue);
    if (patch.reminderAt) patch.reminderAt = new Date(patch.reminderAt as string);

    await ctx.db
      .update(schema.projects)
      .set(patch)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.tenantId, ctx.tenantId)));
    return { id };
  }),

  changeStatus: protectedProcedure.input(projectStatusChangeInput).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.projects)
      .set({ status: input.status })
      .where(and(eq(schema.projects.id, input.id), eq(schema.projects.tenantId, ctx.tenantId)));

    await ctx.db.insert(schema.logbookEntries).values({
      id: idFor.logbookEntry(),
      tenantId: ctx.tenantId,
      entityType: "project",
      entityId: input.id,
      kind: "system",
      message: `Status geändert auf "${input.status}"${input.comment ? ": " + input.comment : ""}.`,
      authorUserId: ctx.userId,
      isSystemEvent: true,
    });
    return { id: input.id };
  }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.projects.id, input.id), eq(schema.projects.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),

  pipeline: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        status: schema.projects.status,
        cnt: count(),
        valueSum: sql<string | null>`sum(${schema.projects.potentialValue})`,
      })
      .from(schema.projects)
      .where(and(eq(schema.projects.tenantId, ctx.tenantId), isNull(schema.projects.deletedAt)))
      .groupBy(schema.projects.status);
    return rows.map((r) => ({
      status: r.status,
      count: Number(r.cnt ?? 0),
      potentialValue: r.valueSum ? Number(r.valueSum) : 0,
    }));
  }),
});

async function nextProjectNumber(
  db: typeof import("@heatflow/db").db,
  tenantId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = `P-${year}-%`;
  const [{ max }] = await db
    .select({ max: sql<string | null>`max(number)` })
    .from(schema.projects)
    .where(and(eq(schema.projects.tenantId, tenantId), ilike(schema.projects.number, pattern)));
  let next = 1;
  if (max) {
    const m = max.match(/(\d+)$/);
    if (m) next = parseInt(m[1] ?? "0", 10) + 1;
  }
  return `P-${year}-${String(next).padStart(3, "0")}`;
}

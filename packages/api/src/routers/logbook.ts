import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

export const logbookRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["project", "contact", "document"]),
        entityId: z.string(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: schema.logbookEntries.id,
          kind: schema.logbookEntries.kind,
          message: schema.logbookEntries.message,
          payload: schema.logbookEntries.payload,
          isSystemEvent: schema.logbookEntries.isSystemEvent,
          occurredAt: schema.logbookEntries.occurredAt,
          authorUserId: schema.logbookEntries.authorUserId,
          authorName: schema.users.name,
        })
        .from(schema.logbookEntries)
        .leftJoin(schema.users, eq(schema.users.id, schema.logbookEntries.authorUserId))
        .where(
          and(
            eq(schema.logbookEntries.entityType, input.entityType),
            eq(schema.logbookEntries.entityId, input.entityId),
            eq(schema.logbookEntries.tenantId, ctx.tenantId),
            isNull(schema.logbookEntries.deletedAt),
          ),
        )
        .orderBy(desc(schema.logbookEntries.occurredAt))
        .limit(input.limit);
    }),

  add: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["project", "contact", "document"]),
        entityId: z.string(),
        kind: z.enum(["note", "call", "email", "event", "weather", "photo"]).default("note"),
        message: z.string().min(1).max(8000),
        visibilityRoles: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = idFor.logbookEntry();
      await ctx.db.insert(schema.logbookEntries).values({
        id,
        tenantId: ctx.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind: input.kind,
        message: input.message,
        authorUserId: ctx.userId,
        visibilityRoles: input.visibilityRoles,
        isSystemEvent: false,
      });
      return { id };
    }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.logbookEntries)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.logbookEntries.id, input.id), eq(schema.logbookEntries.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),
});

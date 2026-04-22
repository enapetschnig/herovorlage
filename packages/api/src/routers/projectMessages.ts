import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M14_KANBAN;

export const projectMessagesRouter = router({
  list: moduleProcedure(M)
    .input(z.object({ projectId: z.string(), limit: z.number().int().min(1).max(500).default(100) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: schema.projectMessages.id,
          message: schema.projectMessages.message,
          createdAt: schema.projectMessages.createdAt,
          userId: schema.projectMessages.userId,
          externalEmail: schema.projectMessages.externalEmail,
          attachments: schema.projectMessages.attachments,
          authorName: schema.users.name,
        })
        .from(schema.projectMessages)
        .leftJoin(schema.users, eq(schema.users.id, schema.projectMessages.userId))
        .where(
          and(
            eq(schema.projectMessages.tenantId, ctx.tenantId),
            eq(schema.projectMessages.projectId, input.projectId),
          ),
        )
        .orderBy(asc(schema.projectMessages.createdAt))
        .limit(input.limit);
    }),

  send: moduleProcedure(M)
    .input(z.object({ projectId: z.string(), message: z.string().min(1).max(8000) }))
    .mutation(async ({ ctx, input }) => {
      const id = idFor.projectMessage();
      await ctx.db.insert(schema.projectMessages).values({
        id,
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        userId: ctx.userId,
        message: input.message,
        attachments: [],
      });
      return { id };
    }),

  unreadCount: moduleProcedure(M)
    .input(z.object({ projectId: z.string(), since: z.string().datetime().optional() }))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(schema.projectMessages.tenantId, ctx.tenantId),
        eq(schema.projectMessages.projectId, input.projectId),
      ];
      if (input.since) {
        filters.push(sql`${schema.projectMessages.createdAt} > ${input.since}`);
      }
      const [{ c }] = await ctx.db
        .select({ c: sql<string>`count(*)` })
        .from(schema.projectMessages)
        .where(and(...filters));
      return Number(c ?? 0);
    }),
});

import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { z } from "zod";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

export const searchRouter = router({
  /**
   * Global Cmd+K search across contacts, projects, articles, documents.
   * Uses ILIKE + the pg_trgm GIN indexes from the bootstrap migration.
   */
  global: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(80), limit: z.number().int().min(1).max(20).default(8) }))
    .query(async ({ ctx, input }) => {
      const s = `%${input.q}%`;

      const [contacts, projects, articles, documents] = await Promise.all([
        ctx.db
          .select({
            id: schema.contacts.id,
            label: sql<string>`coalesce(${schema.contacts.companyName}, concat_ws(' ', ${schema.contacts.firstName}, ${schema.contacts.lastName}))`,
            sub: schema.contacts.customerNumber,
          })
          .from(schema.contacts)
          .where(
            and(
              eq(schema.contacts.tenantId, ctx.tenantId),
              isNull(schema.contacts.deletedAt),
              or(
                ilike(schema.contacts.companyName, s),
                ilike(schema.contacts.firstName, s),
                ilike(schema.contacts.lastName, s),
                ilike(schema.contacts.email, s),
                ilike(schema.contacts.customerNumber, s),
              ),
            ),
          )
          .orderBy(desc(schema.contacts.updatedAt))
          .limit(input.limit),
        ctx.db
          .select({
            id: schema.projects.id,
            label: schema.projects.title,
            sub: schema.projects.number,
            status: schema.projects.status,
          })
          .from(schema.projects)
          .where(
            and(
              eq(schema.projects.tenantId, ctx.tenantId),
              isNull(schema.projects.deletedAt),
              or(ilike(schema.projects.title, s), ilike(schema.projects.number, s)),
            ),
          )
          .orderBy(desc(schema.projects.updatedAt))
          .limit(input.limit),
        ctx.db
          .select({
            id: schema.articles.id,
            label: schema.articles.name,
            sub: schema.articles.number,
          })
          .from(schema.articles)
          .where(
            and(
              eq(schema.articles.tenantId, ctx.tenantId),
              isNull(schema.articles.deletedAt),
              or(ilike(schema.articles.name, s), ilike(schema.articles.number, s)),
            ),
          )
          .orderBy(desc(schema.articles.updatedAt))
          .limit(input.limit),
        ctx.db
          .select({
            id: schema.documents.id,
            label: schema.documents.title,
            sub: schema.documents.number,
            type: schema.documents.type,
          })
          .from(schema.documents)
          .where(
            and(
              eq(schema.documents.tenantId, ctx.tenantId),
              isNull(schema.documents.deletedAt),
              or(ilike(schema.documents.title, s), ilike(schema.documents.number, s)),
            ),
          )
          .orderBy(desc(schema.documents.updatedAt))
          .limit(input.limit),
      ]);

      return { contacts, projects, articles, documents };
    }),
});

import { moduleProcedure, router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { articleCreateSchema, articleListInput } from "@heatflow/schemas";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { and, asc, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";

export const articlesRouter = router({
  list: protectedProcedure.input(articleListInput).query(async ({ ctx, input }) => {
    const { page, pageSize, search, groupId, supplierId } = input;
    const a = schema.articles;
    const filters = [eq(a.tenantId, ctx.tenantId), isNull(a.deletedAt)];
    if (groupId) filters.push(eq(a.groupId, groupId));
    if (supplierId) filters.push(eq(a.supplierId, supplierId));
    if (search) {
      const s = `%${search}%`;
      const or_ = or(ilike(a.name, s), ilike(a.number, s), ilike(a.manufacturerNumber, s), ilike(a.ean, s));
      if (or_) filters.push(or_);
    }
    const offset = (page - 1) * pageSize;
    const [items, [{ total }]] = await Promise.all([
      ctx.db.select().from(a).where(and(...filters)).orderBy(asc(a.name)).limit(pageSize).offset(offset),
      ctx.db.select({ total: count() }).from(a).where(and(...filters)),
    ]);
    return { items, total: Number(total ?? 0), page, pageSize };
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [a] = await ctx.db
      .select()
      .from(schema.articles)
      .where(and(eq(schema.articles.id, input.id), eq(schema.articles.tenantId, ctx.tenantId)))
      .limit(1);
    return a ?? null;
  }),

  create: protectedProcedure.input(articleCreateSchema).mutation(async ({ ctx, input }) => {
    const id = idFor.article();
    await ctx.db.insert(schema.articles).values({
      id,
      tenantId: ctx.tenantId,
      number: input.number ?? null,
      ean: input.ean ?? null,
      name: input.name,
      shortText: input.shortText ?? null,
      longText: input.longText ?? null,
      unit: input.unit,
      purchasePrice: String(input.purchasePrice),
      listPrice: String(input.listPrice),
      salePrice: String(input.salePrice),
      vatPct: String(input.vatPct),
      manufacturer: input.manufacturer ?? null,
      manufacturerNumber: input.manufacturerNumber ?? null,
      groupId: input.groupId ?? null,
      supplierId: input.supplierId ?? null,
      stock: String(input.stock),
      imageUrl: input.imageUrl ?? null,
    });
    return { id };
  }),

  searchQuick: protectedProcedure
    .input(z.object({ q: z.string().min(1).max(80), limit: z.number().int().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      const s = `%${input.q}%`;
      return ctx.db
        .select({
          id: schema.articles.id,
          name: schema.articles.name,
          number: schema.articles.number,
          unit: schema.articles.unit,
          salePrice: schema.articles.salePrice,
          vatPct: schema.articles.vatPct,
          manufacturer: schema.articles.manufacturer,
        })
        .from(schema.articles)
        .where(
          and(
            eq(schema.articles.tenantId, ctx.tenantId),
            isNull(schema.articles.deletedAt),
            or(
              ilike(schema.articles.name, s),
              ilike(schema.articles.number, s),
              ilike(schema.articles.manufacturerNumber, s),
            ),
          ),
        )
        .orderBy(desc(schema.articles.updatedAt))
        .limit(input.limit);
    }),

  /**
   * Bulk-imports Datanorm-parsed articles. Upsert-Strategie: existiert ein Artikel
   * mit gleicher number + tenant_id, wird er aktualisiert (Preis/Text), sonst angelegt.
   * Deletes sind `kind === "delete"` → soft-delete.
   */
  importDatanorm: moduleProcedure(FEATURES.M1_DATANORM)
    .input(
      z.object({
        supplierId: z.string().optional(),
        articles: z
          .array(
            z.object({
              kind: z.enum(["new", "change", "delete"]),
              number: z.string().min(1).max(80),
              shortText: z.string().max(500).optional(),
              longText: z.string().max(8000).optional(),
              unit: z.string().max(20).default("Stk"),
              priceKind: z.enum(["list", "purchase", "net"]),
              priceEuro: z.number().min(0),
              ean: z.string().max(40).optional(),
              matchcode: z.string().max(120).optional(),
              manufacturer: z.string().max(120).optional(),
              manufacturerNumber: z.string().max(120).optional(),
            }),
          )
          .min(1)
          .max(20000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let created = 0;
      let updated = 0;
      let deleted = 0;

      for (const row of input.articles) {
        const [existing] = await ctx.db
          .select({ id: schema.articles.id })
          .from(schema.articles)
          .where(
            and(
              eq(schema.articles.tenantId, ctx.tenantId),
              eq(schema.articles.number, row.number),
              isNull(schema.articles.deletedAt),
            ),
          )
          .limit(1);

        if (row.kind === "delete") {
          if (existing) {
            await ctx.db
              .update(schema.articles)
              .set({ deletedAt: new Date() })
              .where(eq(schema.articles.id, existing.id));
            deleted++;
          }
          continue;
        }

        const priceFields: Record<string, string> = {};
        if (row.priceKind === "list") priceFields.listPrice = String(row.priceEuro);
        if (row.priceKind === "purchase") priceFields.purchasePrice = String(row.priceEuro);
        if (row.priceKind === "net") {
          priceFields.listPrice = String(row.priceEuro);
          priceFields.salePrice = String(row.priceEuro);
        }
        // Default sale price to list price if not yet set (so the article is immediately usable)
        if (!("salePrice" in priceFields) && "listPrice" in priceFields) {
          priceFields.salePrice = priceFields.listPrice!;
        }

        if (existing) {
          await ctx.db
            .update(schema.articles)
            .set({
              name: row.shortText?.slice(0, 300) || row.number,
              shortText: row.shortText ?? null,
              longText: row.longText ?? null,
              unit: row.unit,
              ean: row.ean ?? null,
              matchcode: row.matchcode ?? null,
              manufacturer: row.manufacturer ?? null,
              manufacturerNumber: row.manufacturerNumber ?? null,
              isImported: true,
              importSource: "datanorm",
              supplierId: input.supplierId ?? null,
              ...priceFields,
            })
            .where(eq(schema.articles.id, existing.id));
          updated++;
        } else {
          await ctx.db.insert(schema.articles).values({
            id: idFor.article(),
            tenantId: ctx.tenantId,
            supplierId: input.supplierId ?? null,
            number: row.number,
            name: row.shortText?.slice(0, 300) || row.number,
            shortText: row.shortText ?? null,
            longText: row.longText ?? null,
            unit: row.unit,
            ean: row.ean ?? null,
            matchcode: row.matchcode ?? null,
            manufacturer: row.manufacturer ?? null,
            manufacturerNumber: row.manufacturerNumber ?? null,
            vatPct: "20",
            purchasePrice: priceFields.purchasePrice ?? "0",
            listPrice: priceFields.listPrice ?? "0",
            salePrice: priceFields.salePrice ?? "0",
            isImported: true,
            importSource: "datanorm",
          });
          created++;
        }
      }

      return { created, updated, deleted };
    }),
});

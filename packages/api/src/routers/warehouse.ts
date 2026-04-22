import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { newId } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M6_WAREHOUSE;

export const warehouseRouter = router({
  // ---- Warehouses ----
  warehousesList: moduleProcedure(M).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: schema.warehouses.id,
        name: schema.warehouses.name,
        address: schema.warehouses.address,
        itemCount: sql<string>`(select count(*) from stock_items si where si.warehouse_id = ${schema.warehouses.id} and si.deleted_at is null)`,
        valueSum: sql<string>`(select coalesce(sum(si.quantity * coalesce(a.purchase_price, 0)), 0) from stock_items si left join articles a on a.id = si.article_id where si.warehouse_id = ${schema.warehouses.id} and si.deleted_at is null)`,
      })
      .from(schema.warehouses)
      .where(and(eq(schema.warehouses.tenantId, ctx.tenantId), isNull(schema.warehouses.deletedAt)))
      .orderBy(asc(schema.warehouses.name));
  }),

  createWarehouse: moduleProcedure(M)
    .input(z.object({ name: z.string().min(1).max(120), address: z.string().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const id = newId("wh");
      await ctx.db.insert(schema.warehouses).values({
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        address: input.address ?? null,
      });
      return { id };
    }),

  // ---- Stock items ----
  stockItems: moduleProcedure(M)
    .input(z.object({ warehouseId: z.string().optional(), search: z.string().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const filters = [
        eq(schema.stockItems.tenantId, ctx.tenantId),
        isNull(schema.stockItems.deletedAt),
      ];
      if (input.warehouseId) filters.push(eq(schema.stockItems.warehouseId, input.warehouseId));

      return ctx.db
        .select({
          id: schema.stockItems.id,
          warehouseId: schema.stockItems.warehouseId,
          warehouseName: schema.warehouses.name,
          articleId: schema.stockItems.articleId,
          articleNumber: schema.articles.number,
          articleName: schema.articles.name,
          articleUnit: schema.articles.unit,
          quantity: schema.stockItems.quantity,
          reserved: schema.stockItems.reserved,
          minStock: schema.stockItems.minStock,
          locationCode: schema.stockItems.locationCode,
          purchasePrice: schema.articles.purchasePrice,
        })
        .from(schema.stockItems)
        .leftJoin(schema.warehouses, eq(schema.warehouses.id, schema.stockItems.warehouseId))
        .leftJoin(schema.articles, eq(schema.articles.id, schema.stockItems.articleId))
        .where(and(...filters))
        .orderBy(asc(schema.articles.name));
    }),

  upsertStock: moduleProcedure(M)
    .input(
      z.object({
        warehouseId: z.string(),
        articleId: z.string(),
        minStock: z.number().min(0).optional(),
        locationCode: z.string().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: schema.stockItems.id })
        .from(schema.stockItems)
        .where(
          and(
            eq(schema.stockItems.tenantId, ctx.tenantId),
            eq(schema.stockItems.warehouseId, input.warehouseId),
            eq(schema.stockItems.articleId, input.articleId),
            isNull(schema.stockItems.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        await ctx.db
          .update(schema.stockItems)
          .set({
            minStock: input.minStock !== undefined ? String(input.minStock) : undefined,
            locationCode: input.locationCode ?? undefined,
          })
          .where(eq(schema.stockItems.id, existing.id));
        return { id: existing.id };
      }

      const id = newId("si");
      await ctx.db.insert(schema.stockItems).values({
        id,
        tenantId: ctx.tenantId,
        warehouseId: input.warehouseId,
        articleId: input.articleId,
        quantity: "0",
        reserved: "0",
        minStock: input.minStock !== undefined ? String(input.minStock) : null,
        locationCode: input.locationCode ?? null,
      });
      return { id };
    }),

  // ---- Movements ----
  recordMovement: moduleProcedure(M)
    .input(
      z.object({
        stockItemId: z.string(),
        kind: z.enum(["in", "out", "adjust", "reserve", "unreserve"]),
        quantity: z.number().min(0.001),
        referenceDoc: z.string().max(200).optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({ id: schema.stockItems.id, quantity: schema.stockItems.quantity, reserved: schema.stockItems.reserved })
        .from(schema.stockItems)
        .where(
          and(
            eq(schema.stockItems.id, input.stockItemId),
            eq(schema.stockItems.tenantId, ctx.tenantId),
            isNull(schema.stockItems.deletedAt),
          ),
        )
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const cur = Number(item.quantity);
      const reserved = Number(item.reserved);
      let newQty = cur;
      let newReserved = reserved;

      if (input.kind === "in") newQty = cur + input.quantity;
      else if (input.kind === "out") newQty = cur - input.quantity;
      else if (input.kind === "adjust") newQty = input.quantity;
      else if (input.kind === "reserve") newReserved = reserved + input.quantity;
      else if (input.kind === "unreserve") newReserved = Math.max(0, reserved - input.quantity);

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(schema.stockItems)
          .set({ quantity: String(newQty), reserved: String(newReserved) })
          .where(eq(schema.stockItems.id, input.stockItemId));

        await tx.insert(schema.stockMovements).values({
          id: newId("smv"),
          tenantId: ctx.tenantId,
          stockItemId: input.stockItemId,
          kind: input.kind,
          quantity: String(input.quantity),
          referenceDoc: input.referenceDoc ?? null,
          userId: ctx.userId,
          note: input.note ?? null,
        });
      });

      return { id: input.stockItemId, newQuantity: newQty, newReserved };
    }),

  movements: moduleProcedure(M)
    .input(z.object({ stockItemId: z.string(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: schema.stockMovements.id,
          kind: schema.stockMovements.kind,
          quantity: schema.stockMovements.quantity,
          referenceDoc: schema.stockMovements.referenceDoc,
          note: schema.stockMovements.note,
          createdAt: schema.stockMovements.createdAt,
          userId: schema.stockMovements.userId,
          userName: schema.users.name,
        })
        .from(schema.stockMovements)
        .leftJoin(schema.users, eq(schema.users.id, schema.stockMovements.userId))
        .where(
          and(
            eq(schema.stockMovements.tenantId, ctx.tenantId),
            eq(schema.stockMovements.stockItemId, input.stockItemId),
          ),
        )
        .orderBy(desc(schema.stockMovements.createdAt))
        .limit(input.limit);
    }),

  /** Items with quantity below min_stock — used for re-order alerts. */
  belowMinStock: moduleProcedure(M).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: schema.stockItems.id,
        articleName: schema.articles.name,
        articleNumber: schema.articles.number,
        warehouseName: schema.warehouses.name,
        quantity: schema.stockItems.quantity,
        minStock: schema.stockItems.minStock,
        deficit: sql<string>`${schema.stockItems.minStock} - ${schema.stockItems.quantity}`,
      })
      .from(schema.stockItems)
      .leftJoin(schema.articles, eq(schema.articles.id, schema.stockItems.articleId))
      .leftJoin(schema.warehouses, eq(schema.warehouses.id, schema.stockItems.warehouseId))
      .where(
        and(
          eq(schema.stockItems.tenantId, ctx.tenantId),
          isNull(schema.stockItems.deletedAt),
          sql`${schema.stockItems.minStock} is not null and ${schema.stockItems.quantity} < ${schema.stockItems.minStock}`,
        ),
      );
  }),
});

import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { FEATURES } from "@heatflow/utils/constants";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M5_CALCULATION;

/** Per-project planned-vs-actual comparison per CLAUDE.md Teil I.2 / Teil M.5. */
export const calculationRouter = router({
  /**
   * Returns the project's soll/ist calculation. If no row exists yet, seeds one
   * from the first quote (planned revenue = quote total_net).
   */
  forProject: moduleProcedure(M)
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [proj] = await ctx.db
        .select({ id: schema.projects.id, title: schema.projects.title })
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.id, input.projectId),
            eq(schema.projects.tenantId, ctx.tenantId),
            isNull(schema.projects.deletedAt),
          ),
        )
        .limit(1);
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      // Load the stored planning row, if any
      const [calc] = await ctx.db
        .select()
        .from(schema.projectCalculations)
        .where(eq(schema.projectCalculations.projectId, input.projectId))
        .limit(1);

      // Compute actuals on the fly — always fresh, never stale
      const [{ actualMinutes, hourlyCostAvg }] = await ctx.db
        .select({
          actualMinutes: sql<string>`coalesce(sum(${schema.timeEntries.durationMinutes}), 0)`,
          hourlyCostAvg: sql<string>`coalesce(avg(${schema.wageGroups.hourlyCost}), 0)`,
        })
        .from(schema.timeEntries)
        .leftJoin(schema.users, eq(schema.users.id, schema.timeEntries.userId))
        .leftJoin(schema.wageGroups, eq(schema.wageGroups.tenantId, schema.timeEntries.tenantId))
        .where(
          and(
            eq(schema.timeEntries.tenantId, ctx.tenantId),
            eq(schema.timeEntries.projectId, input.projectId),
            isNull(schema.timeEntries.deletedAt),
          ),
        );

      const actualHours = Number(actualMinutes ?? 0) / 60;
      const avgHourlyCost = Number(hourlyCostAvg ?? 0);
      const actualLaborCost = actualHours * avgHourlyCost;

      // Actual revenue = sum of finalized invoices for this project
      const [{ actualRevenue }] = await ctx.db
        .select({
          actualRevenue: sql<string>`coalesce(sum(${schema.documents.totalNet}), 0)`,
        })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.tenantId, ctx.tenantId),
            eq(schema.documents.projectId, input.projectId),
            isNull(schema.documents.deletedAt),
            inArray(schema.documents.type, ["invoice", "partial_invoice", "final_invoice"]),
          ),
        );

      // Actual material cost: sum of article positions × purchase price (approximation)
      // In V1 we use the document article positions' purchase_price aggregated.
      const materialRows = await ctx.db
        .select({
          qty: schema.documentPositions.quantity,
          ek: sql<string>`coalesce(${schema.articles.purchasePrice}, '0')`,
        })
        .from(schema.documentPositions)
        .leftJoin(schema.articles, eq(schema.articles.id, schema.documentPositions.articleId))
        .leftJoin(schema.documents, eq(schema.documents.id, schema.documentPositions.documentId))
        .where(
          and(
            eq(schema.documents.tenantId, ctx.tenantId),
            eq(schema.documents.projectId, input.projectId),
            isNull(schema.documents.deletedAt),
            eq(schema.documentPositions.kind, "article"),
          ),
        );

      let actualMaterialCost = 0;
      for (const r of materialRows) {
        actualMaterialCost += Number(r.qty) * Number(r.ek);
      }

      // Planned revenue default: first quote total_net if calc is empty
      let plannedRevenueFallback = 0;
      if (!calc) {
        const [quote] = await ctx.db
          .select({ totalNet: schema.documents.totalNet })
          .from(schema.documents)
          .where(
            and(
              eq(schema.documents.tenantId, ctx.tenantId),
              eq(schema.documents.projectId, input.projectId),
              eq(schema.documents.type, "quote"),
              isNull(schema.documents.deletedAt),
            ),
          )
          .limit(1);
        plannedRevenueFallback = Number(quote?.totalNet ?? 0);
      }

      return {
        projectId: proj.id,
        projectTitle: proj.title,
        planned: {
          hours: Number(calc?.plannedHours ?? 0),
          materialCost: Number(calc?.plannedMaterialCost ?? 0),
          totalCost: Number(calc?.plannedTotalCost ?? 0),
          revenue: Number(calc?.plannedRevenue ?? plannedRevenueFallback),
        },
        actual: {
          hours: Math.round(actualHours * 100) / 100,
          laborCost: Math.round(actualLaborCost * 100) / 100,
          materialCost: Math.round(actualMaterialCost * 100) / 100,
          totalCost: Math.round((actualLaborCost + actualMaterialCost) * 100) / 100,
          revenue: Number(actualRevenue ?? 0),
        },
        hasStoredPlan: !!calc,
      };
    }),

  /** Create or update the stored plan row. */
  savePlan: moduleProcedure(M)
    .input(
      z.object({
        projectId: z.string(),
        plannedHours: z.number().min(0).default(0),
        plannedMaterialCost: z.number().min(0).default(0),
        plannedTotalCost: z.number().min(0).default(0),
        plannedRevenue: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ projectId: schema.projectCalculations.projectId })
        .from(schema.projectCalculations)
        .where(eq(schema.projectCalculations.projectId, input.projectId))
        .limit(1);

      if (existing) {
        await ctx.db
          .update(schema.projectCalculations)
          .set({
            plannedHours: String(input.plannedHours),
            plannedMaterialCost: String(input.plannedMaterialCost),
            plannedTotalCost: String(input.plannedTotalCost),
            plannedRevenue: String(input.plannedRevenue),
          })
          .where(eq(schema.projectCalculations.projectId, input.projectId));
      } else {
        await ctx.db.insert(schema.projectCalculations).values({
          projectId: input.projectId,
          tenantId: ctx.tenantId,
          plannedHours: String(input.plannedHours),
          plannedMaterialCost: String(input.plannedMaterialCost),
          plannedTotalCost: String(input.plannedTotalCost),
          plannedRevenue: String(input.plannedRevenue),
          actualHours: "0",
          actualMaterialCost: "0",
          actualTotalCost: "0",
          actualRevenue: "0",
        });
      }
      return { projectId: input.projectId };
    }),
});

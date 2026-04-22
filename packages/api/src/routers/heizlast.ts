import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { parseHeizlastXml, recommendHeatPumps, type HeizlastResult } from "@heatflow/integrations-heizlast";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M8_HEAT_LOAD;

export const heizlastRouter = router({
  /** Parse a heizlast XML and return a structured result + matching heat-pump articles. */
  parseAndRecommend: moduleProcedure(M)
    .input(z.object({ xml: z.string().min(50).max(5_000_000) }))
    .mutation(async ({ ctx, input }) => {
      let parsed: HeizlastResult;
      try {
        parsed = parseHeizlastXml(input.xml);
      } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof Error ? e.message : String(e) });
      }

      // Pull all heat-pump assets/articles candidates from stock
      // (we use articles where the name contains "WP" or "wärmepumpe" + has power_kw via custom_fields)
      const articles = await ctx.db
        .select({
          id: schema.articles.id,
          name: schema.articles.name,
          customFields: schema.articles.customFields,
          number: schema.articles.number,
          manufacturer: schema.articles.manufacturer,
        })
        .from(schema.articles)
        .where(
          and(
            eq(schema.articles.tenantId, ctx.tenantId),
            isNull(schema.articles.deletedAt),
            sql`(${schema.articles.name} ILIKE '%wärmepumpe%' OR ${schema.articles.name} ILIKE '%w/p%' OR ${schema.articles.name} ILIKE '%vitocal%' OR ${schema.articles.name} ILIKE '%aroTHERM%')`,
          ),
        );

      // Try to extract power_kw from name (e.g. "Vitocal 350-G 10kW")
      const candidates = articles.map((a) => {
        const m = a.name.match(/(\d+)\s*kW/i);
        const powerKw = m ? Number(m[1]) : (a.customFields as { power_kw?: number } | null)?.power_kw ?? null;
        return { id: a.id, name: a.name, powerKw, manufacturer: a.manufacturer, number: a.number };
      }).filter((a) => a.powerKw && a.powerKw > 0);

      const recommendations = parsed.building.totalHeatLoadKw > 0
        ? recommendHeatPumps(parsed.building.totalHeatLoadKw, candidates)
        : [];

      return { parsed, recommendations };
    }),

  /** Persist the heizlast result on a project (custom_fields). Optional convenience. */
  attachToProject: moduleProcedure(M)
    .input(
      z.object({
        projectId: z.string(),
        result: z.object({
          source: z.string(),
          building: z.record(z.unknown()),
          rooms: z.array(z.record(z.unknown())),
          recommendedHeatPumpKw: z.number().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [proj] = await ctx.db
        .select({ customFields: schema.projects.customFields })
        .from(schema.projects)
        .where(and(eq(schema.projects.id, input.projectId), eq(schema.projects.tenantId, ctx.tenantId)))
        .limit(1);
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      const merged = { ...(proj.customFields ?? {}), heizlast: input.result };
      await ctx.db
        .update(schema.projects)
        .set({ customFields: merged })
        .where(and(eq(schema.projects.id, input.projectId), eq(schema.projects.tenantId, ctx.tenantId)));

      await ctx.db.insert(schema.logbookEntries).values({
        id: idFor.logbookEntry(),
        tenantId: ctx.tenantId,
        entityType: "project",
        entityId: input.projectId,
        kind: "system",
        message: `Heizlast aus ${input.result.source} importiert: ${(input.result.building as { totalHeatLoadKw?: number }).totalHeatLoadKw ?? "?"} kW.`,
        authorUserId: ctx.userId,
        isSystemEvent: true,
      });

      return { id: input.projectId };
    }),
});

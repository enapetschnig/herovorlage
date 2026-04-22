import { moduleProcedure, router } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor, newId } from "@heatflow/utils/ids";
import { FEATURES } from "@heatflow/utils/constants";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

const M = FEATURES.M13_CHECKLISTS;

const ENTITY_TYPE = z.enum(["project", "maintenance_visit", "document", "contact"]);

const itemSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(300),
  required: z.boolean().optional(),
  group: z.string().max(80).optional(),
  helpText: z.string().max(500).optional(),
});
type ChecklistItem = z.infer<typeof itemSchema>;

export const checklistsRouter = router({
  // ---- Templates ----
  templates: moduleProcedure(M)
    .input(z.object({ entityType: ENTITY_TYPE.optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const filters = [eq(schema.checklistTemplates.tenantId, ctx.tenantId), isNull(schema.checklistTemplates.deletedAt)];
      if (input.entityType) filters.push(eq(schema.checklistTemplates.entityType, input.entityType));
      return ctx.db
        .select()
        .from(schema.checklistTemplates)
        .where(and(...filters))
        .orderBy(schema.checklistTemplates.name);
    }),

  createTemplate: moduleProcedure(M)
    .input(
      z.object({
        name: z.string().min(1).max(200),
        entityType: ENTITY_TYPE,
        items: z.array(itemSchema).min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = newId("ctpl");
      await ctx.db.insert(schema.checklistTemplates).values({
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        entityType: input.entityType,
        items: input.items,
      });
      return { id };
    }),

  updateTemplate: moduleProcedure(M)
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        items: z.array(itemSchema).min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: Record<string, unknown> = {};
      if (input.name) patch.name = input.name;
      if (input.items) patch.items = input.items;
      await ctx.db
        .update(schema.checklistTemplates)
        .set(patch)
        .where(and(eq(schema.checklistTemplates.id, input.id), eq(schema.checklistTemplates.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),

  removeTemplate: moduleProcedure(M)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.checklistTemplates)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.checklistTemplates.id, input.id), eq(schema.checklistTemplates.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),

  // ---- Instances ----
  instancesByEntity: moduleProcedure(M)
    .input(z.object({ entityType: ENTITY_TYPE, entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: schema.checklistInstances.id,
          templateId: schema.checklistInstances.templateId,
          templateName: schema.checklistTemplates.name,
          itemsState: schema.checklistInstances.itemsState,
          completedAt: schema.checklistInstances.completedAt,
          completedByUserId: schema.checklistInstances.completedByUserId,
          createdAt: schema.checklistInstances.createdAt,
          items: schema.checklistTemplates.items,
        })
        .from(schema.checklistInstances)
        .leftJoin(schema.checklistTemplates, eq(schema.checklistTemplates.id, schema.checklistInstances.templateId))
        .where(
          and(
            eq(schema.checklistInstances.tenantId, ctx.tenantId),
            eq(schema.checklistInstances.entityType, input.entityType),
            eq(schema.checklistInstances.entityId, input.entityId),
            isNull(schema.checklistInstances.deletedAt),
          ),
        )
        .orderBy(desc(schema.checklistInstances.createdAt));
    }),

  applyTemplate: moduleProcedure(M)
    .input(
      z.object({
        templateId: z.string(),
        entityType: ENTITY_TYPE,
        entityId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = newId("cins");
      await ctx.db.insert(schema.checklistInstances).values({
        id,
        tenantId: ctx.tenantId,
        templateId: input.templateId,
        entityType: input.entityType,
        entityId: input.entityId,
        itemsState: {},
      });

      // Logbook entry on the entity
      const [tmpl] = await ctx.db
        .select({ name: schema.checklistTemplates.name })
        .from(schema.checklistTemplates)
        .where(eq(schema.checklistTemplates.id, input.templateId))
        .limit(1);
      if (tmpl) {
        await ctx.db.insert(schema.logbookEntries).values({
          id: idFor.logbookEntry(),
          tenantId: ctx.tenantId,
          entityType: input.entityType === "maintenance_visit" ? "project" : input.entityType,
          entityId: input.entityId,
          kind: "system",
          message: `Checkliste „${tmpl.name}" angelegt.`,
          authorUserId: ctx.userId,
          isSystemEvent: true,
        });
      }
      return { id };
    }),

  updateInstanceState: moduleProcedure(M)
    .input(z.object({ id: z.string(), itemsState: z.record(z.boolean()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.checklistInstances)
        .set({ itemsState: input.itemsState })
        .where(and(eq(schema.checklistInstances.id, input.id), eq(schema.checklistInstances.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),

  completeInstance: moduleProcedure(M)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.checklistInstances)
        .set({ completedAt: new Date(), completedByUserId: ctx.userId })
        .where(and(eq(schema.checklistInstances.id, input.id), eq(schema.checklistInstances.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),

  removeInstance: moduleProcedure(M)
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.checklistInstances)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.checklistInstances.id, input.id), eq(schema.checklistInstances.tenantId, ctx.tenantId)));
      return { id: input.id };
    }),
});

export type { ChecklistItem };

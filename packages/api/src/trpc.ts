import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { FeatureKey } from "@heatflow/utils/constants";
import { CORE_FEATURES } from "@heatflow/utils/constants";
import { schema } from "@heatflow/db";
import { and, eq } from "drizzle-orm";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

const requireSession = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.tenantId || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Login erforderlich." });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      role: ctx.role ?? "technician",
    } as Context & { tenantId: string; userId: string; role: string },
  });
});

export const protectedProcedure = publicProcedure.use(requireSession);

/** Throws PAYMENT_REQUIRED-equivalent if a needed module is not active. */
export function requireFeature(feature: FeatureKey) {
  return middleware(async ({ ctx, next }) => {
    if (CORE_FEATURES.includes(feature)) return next();
    if (!ctx.tenantId) throw new TRPCError({ code: "UNAUTHORIZED" });

    const rows = await ctx.db
      .select({ active: schema.tenantFeatures.active })
      .from(schema.tenantFeatures)
      .where(
        and(
          eq(schema.tenantFeatures.tenantId, ctx.tenantId),
          eq(schema.tenantFeatures.featureKey, feature),
          eq(schema.tenantFeatures.active, true),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Modul "${feature}" ist nicht aktiviert. In den Einstellungen → Module aktivieren.`,
      });
    }
    return next();
  });
}

export function moduleProcedure(feature: FeatureKey) {
  return protectedProcedure.use(requireFeature(feature));
}

/** Helper to enforce role on a procedure. */
export function requireRole(...roles: string[]) {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.role || !roles.includes(ctx.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Keine Berechtigung für diese Aktion." });
    }
    return next();
  });
}

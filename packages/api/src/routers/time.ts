import { router, protectedProcedure } from "../trpc";
import { schema } from "@heatflow/db";
import { idFor } from "@heatflow/utils/ids";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNotNull, isNull, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";

const ENTRY_KIND = z.enum(["work", "break", "drive", "office", "consulting", "maintenance"]);

const createInput = z
  .object({
    userId: z.string().optional(),
    projectId: z.string().nullable().optional(),
    activityType: ENTRY_KIND.default("work"),
    categoryId: z.string().optional(),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().optional(),
    breakMinutes: z.number().int().min(0).max(720).default(0),
    billable: z.boolean().default(true),
    comment: z.string().max(1000).optional(),
  })
  .refine((v) => !v.endedAt || new Date(v.endedAt) > new Date(v.startedAt), {
    message: "Ende muss nach Start liegen",
  });

const updateInput = z.object({
  id: z.string(),
  projectId: z.string().nullable().optional(),
  activityType: ENTRY_KIND.optional(),
  categoryId: z.string().nullable().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  breakMinutes: z.number().int().min(0).max(720).optional(),
  billable: z.boolean().optional(),
  comment: z.string().max(1000).optional(),
});

function dayBoundaries(dateStr: string): { start: Date; end: Date } {
  // dateStr is YYYY-MM-DD interpreted as local Vienna day. We use UTC ranges
  // wide enough that a Europe/Vienna day always falls inside (UTC ±2h).
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1, 0, 0, 0));
  return { start, end };
}

function durationMinutes(startedAt: Date, endedAt: Date | null, breakMinutes: number): number | null {
  if (!endedAt) return null;
  const diff = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000);
  return Math.max(0, diff - breakMinutes);
}

export const timeRouter = router({
  /** All entries for a single user on a single day. */
  byDay: protectedProcedure
    .input(z.object({ userId: z.string().optional(), date: z.string().date() }))
    .query(async ({ ctx, input }) => {
      const userId = input.userId ?? ctx.userId;
      const { start, end } = dayBoundaries(input.date);

      const t = schema.timeEntries;
      const items = await ctx.db
        .select({
          id: t.id,
          projectId: t.projectId,
          activityType: t.activityType,
          categoryId: t.categoryId,
          startedAt: t.startedAt,
          endedAt: t.endedAt,
          breakMinutes: t.breakMinutes,
          durationMinutes: t.durationMinutes,
          billable: t.billable,
          comment: t.comment,
          approvedAt: t.approvedAt,
          projectTitle: schema.projects.title,
          projectNumber: schema.projects.number,
          categoryName: schema.timeCategories.name,
          categoryColor: schema.timeCategories.color,
        })
        .from(t)
        .leftJoin(schema.projects, eq(schema.projects.id, t.projectId))
        .leftJoin(schema.timeCategories, eq(schema.timeCategories.id, t.categoryId))
        .where(
          and(
            eq(t.tenantId, ctx.tenantId),
            eq(t.userId, userId),
            isNull(t.deletedAt),
            gte(t.startedAt, start),
            lt(t.startedAt, end),
          ),
        )
        .orderBy(asc(t.startedAt));

      // Roll up
      let workMinutes = 0;
      let pauseMinutes = 0;
      let billableMinutes = 0;
      for (const e of items) {
        const isPause = e.activityType === "break";
        const dur =
          e.durationMinutes ??
          durationMinutes(e.startedAt, e.endedAt, e.breakMinutes) ??
          (e.endedAt ? 0 : Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 60000));
        if (isPause) pauseMinutes += Math.max(0, dur);
        else {
          workMinutes += Math.max(0, dur);
          if (e.billable) billableMinutes += Math.max(0, dur);
        }
      }

      return {
        items,
        summary: { workMinutes, pauseMinutes, billableMinutes },
      };
    }),

  /** Sum hours across all users + projects for a date range (used in dashboards / reports). */
  weeklySummary: protectedProcedure
    .input(z.object({ fromDate: z.string().date(), toDate: z.string().date(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const { start } = dayBoundaries(input.fromDate);
      const { end } = dayBoundaries(input.toDate);
      const filters = [
        eq(schema.timeEntries.tenantId, ctx.tenantId),
        isNull(schema.timeEntries.deletedAt),
        gte(schema.timeEntries.startedAt, start),
        lt(schema.timeEntries.startedAt, end),
      ];
      if (input.userId) filters.push(eq(schema.timeEntries.userId, input.userId));
      return ctx.db
        .select({
          userId: schema.timeEntries.userId,
          userName: schema.users.name,
          totalMinutes: sql<string>`coalesce(sum(${schema.timeEntries.durationMinutes}), 0)`,
          billableMinutes: sql<string>`coalesce(sum(case when ${schema.timeEntries.billable} then ${schema.timeEntries.durationMinutes} else 0 end), 0)`,
          entries: sql<string>`count(*)`,
        })
        .from(schema.timeEntries)
        .leftJoin(schema.users, eq(schema.users.id, schema.timeEntries.userId))
        .where(and(...filters))
        .groupBy(schema.timeEntries.userId, schema.users.name);
    }),

  /** Per-user breakdown of time spent on a single project. */
  byProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          userId: schema.timeEntries.userId,
          userName: schema.users.name,
          totalMinutes: sql<string>`coalesce(sum(${schema.timeEntries.durationMinutes}), 0)`,
          billableMinutes: sql<string>`coalesce(sum(case when ${schema.timeEntries.billable} then ${schema.timeEntries.durationMinutes} else 0 end), 0)`,
          entries: sql<string>`count(*)`,
        })
        .from(schema.timeEntries)
        .leftJoin(schema.users, eq(schema.users.id, schema.timeEntries.userId))
        .where(
          and(
            eq(schema.timeEntries.tenantId, ctx.tenantId),
            isNull(schema.timeEntries.deletedAt),
            eq(schema.timeEntries.projectId, input.projectId),
          ),
        )
        .groupBy(schema.timeEntries.userId, schema.users.name)
        .orderBy(desc(sql`sum(${schema.timeEntries.durationMinutes})`));
    }),

  create: protectedProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    const id = idFor.timeEntry();
    const startedAt = new Date(input.startedAt);
    const endedAt = input.endedAt ? new Date(input.endedAt) : null;
    const dur = durationMinutes(startedAt, endedAt, input.breakMinutes);

    await ctx.db.insert(schema.timeEntries).values({
      id,
      tenantId: ctx.tenantId,
      userId: input.userId ?? ctx.userId,
      projectId: input.projectId ?? null,
      activityType: input.activityType,
      categoryId: input.categoryId ?? null,
      startedAt,
      endedAt,
      breakMinutes: input.breakMinutes,
      durationMinutes: dur,
      billable: input.billable,
      comment: input.comment ?? null,
    });
    return { id };
  }),

  update: protectedProcedure.input(updateInput).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;

    if (patch.startedAt) patch.startedAt = new Date(patch.startedAt as string);
    if (patch.endedAt !== undefined) patch.endedAt = patch.endedAt ? new Date(patch.endedAt as string) : null;

    // Recompute duration if start/end/break changed
    if ("startedAt" in patch || "endedAt" in patch || "breakMinutes" in patch) {
      const [existing] = await ctx.db
        .select({
          startedAt: schema.timeEntries.startedAt,
          endedAt: schema.timeEntries.endedAt,
          breakMinutes: schema.timeEntries.breakMinutes,
        })
        .from(schema.timeEntries)
        .where(and(eq(schema.timeEntries.id, id), eq(schema.timeEntries.tenantId, ctx.tenantId)))
        .limit(1);
      if (existing) {
        const startedAt = (patch.startedAt as Date) ?? existing.startedAt;
        const endedAt = "endedAt" in patch ? (patch.endedAt as Date | null) : existing.endedAt;
        const brk = (patch.breakMinutes as number) ?? existing.breakMinutes;
        patch.durationMinutes = durationMinutes(startedAt, endedAt, brk);
      }
    }

    await ctx.db
      .update(schema.timeEntries)
      .set(patch)
      .where(and(eq(schema.timeEntries.id, id), eq(schema.timeEntries.tenantId, ctx.tenantId)));
    return { id };
  }),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.timeEntries)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.timeEntries.id, input.id), eq(schema.timeEntries.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),

  /** Returns the running entry of the current user (one without ended_at), if any. */
  running: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        id: schema.timeEntries.id,
        startedAt: schema.timeEntries.startedAt,
        projectId: schema.timeEntries.projectId,
        projectTitle: schema.projects.title,
        activityType: schema.timeEntries.activityType,
        comment: schema.timeEntries.comment,
      })
      .from(schema.timeEntries)
      .leftJoin(schema.projects, eq(schema.projects.id, schema.timeEntries.projectId))
      .where(
        and(
          eq(schema.timeEntries.tenantId, ctx.tenantId),
          eq(schema.timeEntries.userId, ctx.userId),
          isNull(schema.timeEntries.endedAt),
          isNull(schema.timeEntries.deletedAt),
        ),
      )
      .orderBy(desc(schema.timeEntries.startedAt))
      .limit(1);
    return row ?? null;
  }),

  /** Starts a new running entry. If one is already running, stop it first. */
  quickStart: protectedProcedure
    .input(
      z.object({
        projectId: z.string().nullable().optional(),
        categoryId: z.string().optional(),
        activityType: ENTRY_KIND.default("work"),
        comment: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // Stop any other running entry first
      await ctx.db
        .update(schema.timeEntries)
        .set({ endedAt: now, durationMinutes: sql`extract(epoch from (now() - started_at))::int / 60` })
        .where(
          and(
            eq(schema.timeEntries.tenantId, ctx.tenantId),
            eq(schema.timeEntries.userId, ctx.userId),
            isNull(schema.timeEntries.endedAt),
            isNull(schema.timeEntries.deletedAt),
          ),
        );

      const id = idFor.timeEntry();
      await ctx.db.insert(schema.timeEntries).values({
        id,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        projectId: input.projectId ?? null,
        activityType: input.activityType,
        categoryId: input.categoryId ?? null,
        startedAt: now,
        endedAt: null,
        breakMinutes: 0,
        durationMinutes: null,
        billable: input.activityType !== "break",
        comment: input.comment ?? null,
      });
      return { id };
    }),

  /** Stops the user's currently running entry (if any). */
  quickStop: protectedProcedure.mutation(async ({ ctx }) => {
    const [running] = await ctx.db
      .select({ id: schema.timeEntries.id, startedAt: schema.timeEntries.startedAt })
      .from(schema.timeEntries)
      .where(
        and(
          eq(schema.timeEntries.tenantId, ctx.tenantId),
          eq(schema.timeEntries.userId, ctx.userId),
          isNull(schema.timeEntries.endedAt),
          isNull(schema.timeEntries.deletedAt),
        ),
      )
      .limit(1);
    if (!running) throw new TRPCError({ code: "NOT_FOUND", message: "Kein laufender Zeiteintrag." });

    const ended = new Date();
    const dur = Math.max(0, Math.floor((ended.getTime() - running.startedAt.getTime()) / 60000));
    await ctx.db
      .update(schema.timeEntries)
      .set({ endedAt: ended, durationMinutes: dur })
      .where(eq(schema.timeEntries.id, running.id));
    return { id: running.id, durationMinutes: dur };
  }),

  /** Approve an entry (foreman/owner action). */
  approve: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db
      .update(schema.timeEntries)
      .set({ approvedByUserId: ctx.userId, approvedAt: new Date() })
      .where(and(eq(schema.timeEntries.id, input.id), eq(schema.timeEntries.tenantId, ctx.tenantId)));
    return { id: input.id };
  }),

  /** Bulk-approve all entries of a user in a date range. Foreman/owner action. */
  approveRange: protectedProcedure
    .input(z.object({ userId: z.string(), fromDate: z.string().date(), toDate: z.string().date() }))
    .mutation(async ({ ctx, input }) => {
      const { start } = dayBoundaries(input.fromDate);
      const { end } = dayBoundaries(input.toDate);
      const result = await ctx.db
        .update(schema.timeEntries)
        .set({ approvedByUserId: ctx.userId, approvedAt: new Date() })
        .where(
          and(
            eq(schema.timeEntries.tenantId, ctx.tenantId),
            eq(schema.timeEntries.userId, input.userId),
            isNull(schema.timeEntries.deletedAt),
            isNull(schema.timeEntries.approvedAt),
            isNotNull(schema.timeEntries.endedAt),
            gte(schema.timeEntries.startedAt, start),
            lt(schema.timeEntries.startedAt, end),
          ),
        )
        .returning({ id: schema.timeEntries.id });
      return { approved: result.length };
    }),

  /** Returns daily work-minute buckets for a date range — used by the week view. */
  byWeek: protectedProcedure
    .input(z.object({ userId: z.string().optional(), fromDate: z.string().date(), toDate: z.string().date() }))
    .query(async ({ ctx, input }) => {
      const userId = input.userId ?? ctx.userId;
      const { start } = dayBoundaries(input.fromDate);
      const { end } = dayBoundaries(input.toDate);

      const rows = await ctx.db
        .select({
          startedAt: schema.timeEntries.startedAt,
          endedAt: schema.timeEntries.endedAt,
          breakMinutes: schema.timeEntries.breakMinutes,
          durationMinutes: schema.timeEntries.durationMinutes,
          activityType: schema.timeEntries.activityType,
          billable: schema.timeEntries.billable,
          approvedAt: schema.timeEntries.approvedAt,
          projectId: schema.timeEntries.projectId,
          projectTitle: schema.projects.title,
          projectNumber: schema.projects.number,
        })
        .from(schema.timeEntries)
        .leftJoin(schema.projects, eq(schema.projects.id, schema.timeEntries.projectId))
        .where(
          and(
            eq(schema.timeEntries.tenantId, ctx.tenantId),
            eq(schema.timeEntries.userId, userId),
            isNull(schema.timeEntries.deletedAt),
            gte(schema.timeEntries.startedAt, start),
            lt(schema.timeEntries.startedAt, end),
          ),
        )
        .orderBy(asc(schema.timeEntries.startedAt));

      type Entry = typeof rows[number] & { duration: number };
      type Bucket = { date: string; workMinutes: number; pauseMinutes: number; pendingApproval: number; entries: Entry[] };
      const days = new Map<string, Bucket>();

      for (const r of rows) {
        const day = (r.startedAt instanceof Date ? r.startedAt : new Date(r.startedAt)).toISOString().slice(0, 10);
        let bucket = days.get(day);
        if (!bucket) {
          bucket = { date: day, workMinutes: 0, pauseMinutes: 0, pendingApproval: 0, entries: [] };
          days.set(day, bucket);
        }
        const dur = r.durationMinutes ?? (r.endedAt ? Math.floor((new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime()) / 60000) - r.breakMinutes : 0);
        const safe = Math.max(0, dur);
        if (r.activityType === "break") bucket.pauseMinutes += safe;
        else bucket.workMinutes += safe;
        if (!r.approvedAt) bucket.pendingApproval++;
        bucket.entries.push({ ...r, duration: safe });
      }

      const out: Bucket[] = [];
      const startD = new Date(input.fromDate + "T00:00:00Z");
      const endD = new Date(input.toDate + "T00:00:00Z");
      for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10);
        out.push(days.get(day) ?? { date: day, workMinutes: 0, pauseMinutes: 0, pendingApproval: 0, entries: [] });
      }

      const totals = {
        workMinutes: out.reduce((s, d) => s + d.workMinutes, 0),
        pauseMinutes: out.reduce((s, d) => s + d.pauseMinutes, 0),
        pendingApproval: out.reduce((s, d) => s + d.pendingApproval, 0),
      };

      return { days: out, totals };
    }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(schema.timeCategories)
      .where(and(eq(schema.timeCategories.tenantId, ctx.tenantId), isNull(schema.timeCategories.deletedAt)))
      .orderBy(schema.timeCategories.name);
  }),
});

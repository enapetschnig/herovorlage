import { boolean, date, index, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";
import { projects } from "./projects";

export const timeCategories = pgTable(
  "time_categories",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#10b981"),
    billable: boolean("billable").notNull().default(true),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("time_categories_tenant_idx").on(t.tenantId) }),
);

export const wageGroups = pgTable(
  "wage_groups",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }).notNull().default("0"),
    hourlyCost: numeric("hourly_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("wage_groups_tenant_idx").on(t.tenantId) }),
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    taskId: text("task_id"),
    activityType: text("activity_type").notNull().default("work"),
    categoryId: text("category_id").references(() => timeCategories.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    breakMinutes: integer("break_minutes").notNull().default(0),
    durationMinutes: integer("duration_minutes"),
    billable: boolean("billable").notNull().default(true),
    comment: text("comment"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("time_entries_tenant_idx").on(t.tenantId),
    userIdx: index("time_entries_user_idx").on(t.tenantId, t.userId, t.startedAt),
    projectIdx: index("time_entries_project_idx").on(t.projectId),
  }),
);

export const absences = pgTable(
  "absences",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // vacation | sick | other
    fromDate: date("from_date").notNull(),
    toDate: date("to_date").notNull(),
    note: text("note"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({ userIdx: index("absences_user_idx").on(t.userId) }),
);

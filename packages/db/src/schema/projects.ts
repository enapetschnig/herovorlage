import { date, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { customFieldsCol, idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";
import { contactAddresses, contacts } from "./contacts";

export const projectTypes = pgTable(
  "project_types",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#3b82f6"),
    trade: text("trade"),
    defaultStages: jsonb("default_stages").$type<string[]>().default([]).notNull(),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("project_types_tenant_idx").on(t.tenantId) }),
);

export const projects = pgTable(
  "projects",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("lead"),
    pipelineStage: text("pipeline_stage"),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    addressId: text("address_id").references(() => contactAddresses.id),
    projectTypeId: text("project_type_id").references(() => projectTypes.id),
    trade: text("trade"),
    branchId: text("branch_id"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    potentialValue: numeric("potential_value", { precision: 12, scale: 2 }),
    actualValue: numeric("actual_value", { precision: 12, scale: 2 }),
    source: text("source"),
    description: text("description"),
    responsibleUserId: text("responsible_user_id").references(() => users.id, { onDelete: "set null" }),
    reminderAt: timestamp("reminder_at", { withTimezone: true }),
    customFields: customFieldsCol(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("projects_tenant_idx").on(t.tenantId),
    statusIdx: index("projects_status_idx").on(t.tenantId, t.status),
    contactIdx: index("projects_contact_idx").on(t.contactId),
  }),
);

export const projectStages = pgTable(
  "project_stages",
  {
    id: idCol(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    orderNum: integer("order_num").notNull().default(0),
    status: text("status").notNull().default("pending"), // pending | active | done | skipped
    enteredAt: timestamp("entered_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => ({
    projectIdx: index("project_stages_project_idx").on(t.projectId),
  }),
);

export const projectParticipants = pgTable(
  "project_participants",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.projectId, t.userId] }),
  }),
);

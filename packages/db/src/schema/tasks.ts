import { date, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";
import { contacts } from "./contacts";
import { projects } from "./projects";

export const tasks = pgTable(
  "tasks",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    parentTaskId: text("parent_task_id"),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    assignedUserId: text("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    orderNum: integer("order_num").default(0),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("tasks_tenant_idx").on(t.tenantId),
    statusIdx: index("tasks_status_idx").on(t.tenantId, t.status),
    projectIdx: index("tasks_project_idx").on(t.projectId),
    assignedIdx: index("tasks_assigned_idx").on(t.assignedUserId),
  }),
);

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    defaultDueDays: integer("default_due_days").default(7),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("task_templates_tenant_idx").on(t.tenantId) }),
);

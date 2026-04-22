import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";

export const auditLog = pgTable(
  "audit_log",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // create | update | delete | login | finalize
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index("audit_log_tenant_idx").on(t.tenantId),
    entityIdx: index("audit_log_entity_idx").on(t.entityType, t.entityId),
    atIdx: index("audit_log_at_idx").on(t.at),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId, t.readAt),
  }),
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    context: text("context"), // quote_send | invoice_send | reminder | maintenance_due
    subject: text("subject").notNull(),
    bodyHtml: text("body_html"),
    bodyText: text("body_text"),
    variables: jsonb("variables").$type<string[]>().default([]).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("email_templates_tenant_idx").on(t.tenantId) }),
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    toAddress: text("to_address").notNull(),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("pending"), // pending | sent | failed
    sentAt: timestamp("sent_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    messageId: text("message_id"),
    createdAt: timestamps.createdAt,
  },
  (t) => ({ statusIdx: index("email_outbox_status_idx").on(t.status) }),
);

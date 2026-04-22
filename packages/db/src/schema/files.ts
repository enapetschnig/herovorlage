import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";
import { contacts } from "./contacts";
import { projects } from "./projects";

export const folders = pgTable(
  "folders",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    entityType: text("entity_type"), // "project" | "contact" | null = global
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("folders_tenant_idx").on(t.tenantId) }),
);

export const files = pgTable(
  "files",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => folders.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull().default(0),
    storageBucket: text("storage_bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedByUserId: text("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    label: text("label"),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("files_tenant_idx").on(t.tenantId),
    projectIdx: index("files_project_idx").on(t.projectId),
    contactIdx: index("files_contact_idx").on(t.contactId),
  }),
);

export const logbookEntries = pgTable(
  "logbook_entries",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // project | contact | document
    entityId: text("entity_id").notNull(),
    kind: text("kind").notNull().default("note"), // note | event | call | email | system | weather | photo
    message: text("message").notNull(),
    payload: jsonb("payload").default({}).notNull(),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    visibilityRoles: jsonb("visibility_roles").$type<string[]>().default([]).notNull(),
    isSystemEvent: boolean("is_system_event").notNull().default(false),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("logbook_tenant_idx").on(t.tenantId),
    entityIdx: index("logbook_entity_idx").on(t.entityType, t.entityId),
    occurredAtIdx: index("logbook_occurred_at_idx").on(t.occurredAt),
  }),
);

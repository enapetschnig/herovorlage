import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { customFieldsCol, idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";
import { contactAddresses, contacts } from "./contacts";
import { projects } from "./projects";
import { articles, services } from "./articles";

export const documents = pgTable(
  "documents",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // quote | order_confirmation | delivery_note | invoice | partial_invoice | final_invoice | credit_note
    number: text("number").notNull(),
    title: text("title"),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id),
    addressId: text("address_id").references(() => contactAddresses.id),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    referenceDocumentId: text("reference_document_id"),
    documentDate: date("document_date").notNull(),
    dueDate: date("due_date"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("EUR"),
    introText: text("intro_text"),
    closingText: text("closing_text"),
    totalNet: numeric("total_net", { precision: 12, scale: 2 }).notNull().default("0"),
    totalVat: numeric("total_vat", { precision: 12, scale: 2 }).notNull().default("0"),
    totalGross: numeric("total_gross", { precision: 12, scale: 2 }).notNull().default("0"),
    locked: boolean("locked").notNull().default(false),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedByUserId: text("locked_by_user_id").references(() => users.id, { onDelete: "set null" }),
    pdfStorageKey: text("pdf_storage_key"),
    customFields: customFieldsCol(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("documents_tenant_idx").on(t.tenantId),
    typeStatusIdx: index("documents_type_status_idx").on(t.tenantId, t.type, t.status),
    contactIdx: index("documents_contact_idx").on(t.contactId),
    projectIdx: index("documents_project_idx").on(t.projectId),
    numberUq: uniqueIndex("documents_number_uq").on(t.tenantId, t.number),
  }),
);

export const documentPositions = pgTable(
  "document_positions",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    parentPositionId: text("parent_position_id"),
    orderNum: integer("order_num").notNull().default(0),
    kind: text("kind").notNull().default("article"), // article | service | text | subtotal | title
    articleId: text("article_id").references(() => articles.id, { onDelete: "set null" }),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    positionNumber: text("position_number"),
    description: text("description").notNull().default(""),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    unit: text("unit").notNull().default("Stk"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull().default("0"),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("20"),
    totalNet: numeric("total_net", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (t) => ({
    documentIdx: index("document_positions_document_idx").on(t.documentId),
    orderIdx: index("document_positions_order_idx").on(t.documentId, t.orderNum),
  }),
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    documentIdx: index("document_versions_document_idx").on(t.documentId),
  }),
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type"), // null = applicable to all types
    introText: text("intro_text"),
    closingText: text("closing_text"),
    layout: jsonb("layout").default({}).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("document_templates_tenant_idx").on(t.tenantId) }),
);

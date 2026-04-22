import { boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { customFieldsCol, idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";
import { contacts } from "./contacts";
import { projects } from "./projects";
import { articles } from "./articles";

// -----------------------------------------------------------------------------
// M3 — Wartung & Anlagen
// -----------------------------------------------------------------------------
export const assets = pgTable(
  "assets",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    assetType: text("asset_type").notNull(), // heat_pump | buffer | dhw | pv | meter | other
    brand: text("brand"),
    model: text("model"),
    serialNumber: text("serial_number"),
    installationDate: date("installation_date"),
    warrantyUntil: date("warranty_until"),
    locationDescription: text("location_description"),
    powerKw: numeric("power_kw", { precision: 8, scale: 2 }),
    cop: numeric("cop", { precision: 4, scale: 2 }),
    refrigerant: text("refrigerant"), // R290 | R32 | R410A | ...
    soundLevelDb: numeric("sound_level_db", { precision: 5, scale: 1 }),
    customFields: customFieldsCol(),
    ...timestamps,
  },
  (t) => ({
    contactIdx: index("assets_contact_idx").on(t.contactId),
    serialIdx: index("assets_serial_idx").on(t.tenantId, t.serialNumber),
  }),
);

export const maintenanceContracts = pgTable(
  "maintenance_contracts",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    assetId: text("asset_id").references(() => assets.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    intervalMonths: integer("interval_months").notNull().default(12),
    nextDueDate: date("next_due_date"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    autoRenewal: boolean("auto_renewal").notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    contactIdx: index("maintenance_contact_idx").on(t.contactId),
    nextDueIdx: index("maintenance_next_due_idx").on(t.nextDueDate),
  }),
);

export const maintenanceVisits = pgTable(
  "maintenance_visits",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contractId: text("contract_id")
      .notNull()
      .references(() => maintenanceContracts.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    technicianUserId: text("technician_user_id").references(() => users.id, { onDelete: "set null" }),
    protocol: jsonb("protocol").default({}).notNull(),
    issuesFound: text("issues_found"),
    followUpRequired: boolean("follow_up_required").notNull().default(false),
    ...timestamps,
  },
  (t) => ({ contractIdx: index("maintenance_visits_contract_idx").on(t.contractId) }),
);

// -----------------------------------------------------------------------------
// M5 — Soll/Ist-Kalkulation pro Projekt
// -----------------------------------------------------------------------------
export const projectCalculations = pgTable("project_calculations", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  plannedHours: numeric("planned_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  plannedMaterialCost: numeric("planned_material_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  plannedTotalCost: numeric("planned_total_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  plannedRevenue: numeric("planned_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  actualHours: numeric("actual_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  actualMaterialCost: numeric("actual_material_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  actualTotalCost: numeric("actual_total_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  actualRevenue: numeric("actual_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
  ...timestamps,
});

// -----------------------------------------------------------------------------
// M6 — Lagerverwaltung
// -----------------------------------------------------------------------------
export const warehouses = pgTable(
  "warehouses",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address"),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("warehouses_tenant_idx").on(t.tenantId) }),
);

export const stockItems = pgTable(
  "stock_items",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("0"),
    reserved: numeric("reserved", { precision: 12, scale: 3 }).notNull().default("0"),
    minStock: numeric("min_stock", { precision: 12, scale: 3 }),
    locationCode: text("location_code"),
    ...timestamps,
  },
  (t) => ({ warehouseIdx: index("stock_items_warehouse_idx").on(t.warehouseId) }),
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    stockItemId: text("stock_item_id")
      .notNull()
      .references(() => stockItems.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // in | out | adjust | reserve | unreserve
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    referenceDoc: text("reference_doc"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (t) => ({ stockItemIdx: index("stock_movements_item_idx").on(t.stockItemId) }),
);

// -----------------------------------------------------------------------------
// M7 — Förderung
// -----------------------------------------------------------------------------
export const fundingPrograms = pgTable("funding_programs", {
  id: idCol(),
  name: text("name").notNull(),
  country: text("country").notNull(), // DE | AT | CH
  region: text("region"),
  description: text("description"),
  maxAmount: numeric("max_amount", { precision: 12, scale: 2 }),
  requirements: jsonb("requirements").default({}).notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const fundingApplications = pgTable(
  "funding_applications",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    programId: text("program_id")
      .notNull()
      .references(() => fundingPrograms.id),
    status: text("status").notNull().default("draft"), // draft | submitted | approved | rejected | paid
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    amountRequested: numeric("amount_requested", { precision: 12, scale: 2 }),
    amountApproved: numeric("amount_approved", { precision: 12, scale: 2 }),
    documentIds: jsonb("document_ids").$type<string[]>().default([]).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({ projectIdx: index("funding_applications_project_idx").on(t.projectId) }),
);

// -----------------------------------------------------------------------------
// M13 — Checklisten
// -----------------------------------------------------------------------------
export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    entityType: text("entity_type").notNull(), // project | maintenance_visit | document
    items: jsonb("items").$type<Array<{ id: string; label: string; required?: boolean }>>().notNull(),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("checklist_templates_tenant_idx").on(t.tenantId) }),
);

export const checklistInstances = pgTable("checklist_instances", {
  id: idCol(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  templateId: text("template_id")
    .notNull()
    .references(() => checklistTemplates.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  itemsState: jsonb("items_state").$type<Record<string, boolean>>().default({}).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedByUserId: text("completed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

// -----------------------------------------------------------------------------
// M14 — Kanban + Projekt-Chat
// -----------------------------------------------------------------------------
export const kanbanBoards = pgTable("kanban_boards", {
  id: idCol(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  columns: jsonb("columns").$type<Array<{ id: string; name: string; color?: string }>>().notNull(),
  ...timestamps,
});

export const projectMessages = pgTable(
  "project_messages",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    externalEmail: text("external_email"),
    message: text("message").notNull(),
    attachments: jsonb("attachments").default([]).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => ({ projectIdx: index("project_messages_project_idx").on(t.projectId) }),
);

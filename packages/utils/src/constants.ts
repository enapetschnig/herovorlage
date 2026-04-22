/** Module IDs from CLAUDE.md Teil D — used for feature-flag checks across the app. */
export const FEATURES = {
  // Core (always on)
  CORE_CONTACTS: "core.contacts",
  CORE_PROJECTS: "core.projects",
  CORE_DOCUMENTS: "core.documents",
  CORE_ARTICLES: "core.articles",
  CORE_TIME: "core.time",
  CORE_E_INVOICE: "core.e_invoice",
  CORE_MOBILE: "core.mobile",
  CORE_PORTAL: "core.portal",
  // Modules
  M1_DATANORM: "m1.datanorm",
  M2_IDS_CONNECT: "m2.ids_connect",
  M3_MAINTENANCE: "m3.maintenance",
  M4_PLANNING: "m4.planning",
  M5_CALCULATION: "m5.calculation",
  M6_WAREHOUSE: "m6.warehouse",
  M7_FUNDING: "m7.funding",
  M8_HEAT_LOAD: "m8.heat_load",
  M9_MANUFACTURER_API: "m9.manufacturer_api",
  M10_DATEV: "m10.datev",
  M11_SEPA: "m11.sepa",
  M12_FLOW_AI: "m12.flow_ai",
  M13_CHECKLISTS: "m13.checklists",
  M14_KANBAN: "m14.kanban",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export const CORE_FEATURES: FeatureKey[] = [
  FEATURES.CORE_CONTACTS,
  FEATURES.CORE_PROJECTS,
  FEATURES.CORE_DOCUMENTS,
  FEATURES.CORE_ARTICLES,
  FEATURES.CORE_TIME,
  FEATURES.CORE_E_INVOICE,
  FEATURES.CORE_MOBILE,
  FEATURES.CORE_PORTAL,
];

export const ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  OFFICE: "office",
  PLANNER: "planner",
  FOREMAN: "foreman",
  TECHNICIAN: "technician",
  ACCOUNTANT: "accountant",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CONTACT_TYPES = ["customer", "supplier", "partner", "other"] as const;
export const CONTACT_KINDS = ["person", "company"] as const;
export const ADDRESS_KINDS = ["billing", "shipping", "site", "main"] as const;

export const PROJECT_STATUSES = [
  "lead",
  "quoted",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "quote",
  "order_confirmation",
  "delivery_note",
  "invoice",
  "partial_invoice",
  "final_invoice",
  "credit_note",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "paid",
  "overdue",
  "cancelled",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const POSITION_KINDS = ["article", "service", "text", "subtotal", "title"] as const;
export type PositionKind = (typeof POSITION_KINDS)[number];

/** Stage templates for project_types — the heat-pump preset (Teil M). */
export const HEAT_PUMP_STAGES = [
  "Beratung",
  "Vor-Ort-Termin",
  "Heizlast-Berechnung",
  "Angebot",
  "Förderung beantragt",
  "Auftrag",
  "Materialbestellung",
  "Installation",
  "Inbetriebnahme",
  "Abnahme",
  "Rechnung",
  "Wartung",
];

import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customFieldsCol, idCol, timestamps } from "./_helpers";
import { tenants, users } from "./tenants";

export const tags = pgTable(
  "tags",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#6366f1"),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("tags_tenant_idx").on(t.tenantId),
    nameIdx: uniqueIndex("tags_tenant_name_uq").on(t.tenantId, t.name),
  }),
);

export const contacts = pgTable(
  "contacts",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("customer"), // customer | supplier | partner | other
    kind: text("kind").notNull().default("person"), // person | company
    customerNumber: text("customer_number"),
    salutation: text("salutation"),
    title: text("title"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    fax: text("fax"),
    website: text("website"),
    birthday: date("birthday"),
    category: text("category"),
    source: text("source"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(14),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    skontoPct: numeric("skonto_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    skontoDays: integer("skonto_days").notNull().default(0),
    iban: text("iban"),
    bic: text("bic"),
    bankName: text("bank_name"),
    vatId: text("vat_id"),
    leitwegId: text("leitweg_id"),
    debitorAccount: text("debitor_account"),
    creditorAccount: text("creditor_account"),
    isInvoiceRecipient: boolean("is_invoice_recipient").default(true),
    notes: text("notes"),
    customFields: customFieldsCol(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("contacts_tenant_idx").on(t.tenantId),
    typeIdx: index("contacts_type_idx").on(t.tenantId, t.type),
    nameIdx: index("contacts_name_idx").on(t.tenantId, t.lastName, t.companyName),
    customerNumberUq: uniqueIndex("contacts_customer_number_uq").on(t.tenantId, t.customerNumber),
  }),
);

export const contactAddresses = pgTable(
  "contact_addresses",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("main"), // main | billing | shipping | site
    label: text("label"),
    street: text("street"),
    zip: text("zip"),
    city: text("city"),
    country: text("country").default("AT"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    ...timestamps,
  },
  (t) => ({
    contactIdx: index("contact_addresses_contact_idx").on(t.contactId),
  }),
);

export const contactPersons = pgTable(
  "contact_persons",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    salutation: text("salutation"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    position: text("position"),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    isPrimary: boolean("is_primary").default(false),
    ...timestamps,
  },
  (t) => ({
    contactIdx: index("contact_persons_contact_idx").on(t.contactId),
  }),
);

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.contactId, t.tagId] }),
  }),
);

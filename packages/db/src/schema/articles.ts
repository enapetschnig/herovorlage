import { boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { customFieldsCol, idCol, timestamps } from "./_helpers";
import { tenants } from "./tenants";
import { contacts } from "./contacts";

export const articleGroups = pgTable(
  "article_groups",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    orderNum: integer("order_num").notNull().default(0),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("article_groups_tenant_idx").on(t.tenantId) }),
);

export const articles = pgTable(
  "articles",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id").references(() => contacts.id, { onDelete: "set null" }),
    groupId: text("group_id").references(() => articleGroups.id, { onDelete: "set null" }),
    number: text("number"),
    ean: text("ean"),
    name: text("name").notNull(),
    shortText: text("short_text"),
    longText: text("long_text"),
    unit: text("unit").notNull().default("Stk"),
    purchasePrice: numeric("purchase_price", { precision: 12, scale: 4 }).notNull().default("0"),
    listPrice: numeric("list_price", { precision: 12, scale: 4 }).notNull().default("0"),
    salePrice: numeric("sale_price", { precision: 12, scale: 4 }).notNull().default("0"),
    vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("20"),
    manufacturer: text("manufacturer"),
    manufacturerNumber: text("manufacturer_number"),
    stock: numeric("stock", { precision: 12, scale: 3 }).notNull().default("0"),
    minOrderQty: numeric("min_order_qty", { precision: 12, scale: 3 }),
    deliveryDays: integer("delivery_days"),
    imageUrl: text("image_url"),
    isImported: boolean("is_imported").notNull().default(false),
    importSource: text("import_source"),
    matchcode: text("matchcode"),
    customFields: customFieldsCol(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("articles_tenant_idx").on(t.tenantId),
    numberIdx: index("articles_number_idx").on(t.tenantId, t.number),
    nameIdx: index("articles_name_idx").on(t.tenantId, t.name),
  }),
);

export const services = pgTable(
  "services",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number"),
    name: text("name").notNull(),
    description: text("description"),
    /** Stores the calculation tree: material lines + labor lines + summary. */
    calculation: jsonb("calculation").$type<Record<string, unknown>>().default({}).notNull(),
    purchaseCost: numeric("purchase_cost", { precision: 12, scale: 4 }).notNull().default("0"),
    salePrice: numeric("sale_price", { precision: 12, scale: 4 }).notNull().default("0"),
    vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("20"),
    unit: text("unit").default("Stk"),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("services_tenant_idx").on(t.tenantId),
  }),
);

export const priceLists = pgTable(
  "price_lists",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => ({ tenantIdx: index("price_lists_tenant_idx").on(t.tenantId) }),
);

export const priceListItems = pgTable(
  "price_list_items",
  {
    priceListId: text("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    validFrom: text("valid_from"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.priceListId, t.articleId] }) }),
);

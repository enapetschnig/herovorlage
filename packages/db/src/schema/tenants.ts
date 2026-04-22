import { boolean, index, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { idCol, timestamps } from "./_helpers";

export const tenants = pgTable(
  "tenants",
  {
    id: idCol(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    slug: text("slug").notNull(),
    country: text("country").notNull().default("AT"),
    currency: text("currency").notNull().default("EUR"),
    locale: text("locale").notNull().default("de-AT"),
    vatId: text("vat_id"),
    addressStreet: text("address_street"),
    addressZip: text("address_zip"),
    addressCity: text("address_city"),
    addressCountry: text("address_country").default("AT"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    iban: text("iban"),
    bic: text("bic"),
    bankName: text("bank_name"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color").default("#1e6fff"),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    plan: text("plan").notNull().default("demo"), // demo | trial | active | past_due | cancelled
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    billingEmail: text("billing_email"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    slugIdx: uniqueIndex("tenants_slug_idx").on(t.slug),
  }),
);

export const users = pgTable(
  "users",
  {
    id: idCol(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    role: text("role").notNull().default("technician"),
    avatarUrl: text("avatar_url"),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    twoFactorSecret: text("two_factor_secret"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
    ...timestamps,
  },
  (t) => ({
    tenantIdx: index("users_tenant_idx").on(t.tenantId),
    emailUq: uniqueIndex("users_email_uq").on(t.email),
  }),
);

export const tenantFeatures = pgTable(
  "tenant_features",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    featureKey: text("feature_key").notNull(),
    active: boolean("active").notNull().default(true),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.featureKey] }),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: idCol(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamps.createdAt,
  },
  (t) => ({
    tokenUq: uniqueIndex("sessions_token_uq").on(t.sessionToken),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

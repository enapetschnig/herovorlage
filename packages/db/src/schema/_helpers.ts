import { sql } from "drizzle-orm";
import { text, timestamp, jsonb } from "drizzle-orm/pg-core";

/** Standard primary-key column for all entities (ULID, generated client-side). */
export const idCol = () => text("id").primaryKey().notNull();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const customFieldsCol = () =>
  jsonb("custom_fields").$type<Record<string, unknown>>().default({}).notNull();

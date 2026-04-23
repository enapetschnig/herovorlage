import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __heatflowDbClient: DrizzleDb | undefined;
  // eslint-disable-next-line no-var
  var __heatflowSql: ReturnType<typeof postgres> | undefined;
}

function buildClient(): DrizzleDb {
  const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!url) {
    // During `next build` (when DATABASE_URL is not wired), return a dummy drizzle
    // instance backed by a postgres connection string that will never be dialed.
    // Build only needs types and static analysis — it never executes queries.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      const dummySql = postgres("postgres://build:build@localhost:5432/build", {
        prepare: false,
        connection: { application_name: "heatflow-build-dummy" },
      });
      return drizzle(dummySql, { schema, casing: "snake_case" });
    }
    throw new Error("DATABASE_URL not set");
  }
  const isPooler = url.includes("pooler.supabase.com");
  const sql = postgres(url, {
    prepare: !isPooler,
    max: isPooler ? 5 : 10,
    idle_timeout: 30,
  });
  globalThis.__heatflowSql = sql;
  return drizzle(sql, { schema, casing: "snake_case" });
}

/** Singleton — survives Next.js HMR. Eagerly constructed at import time. */
export const db: DrizzleDb =
  globalThis.__heatflowDbClient ?? (globalThis.__heatflowDbClient = buildClient());

export type Db = DrizzleDb;

export { schema };

export async function closeDb(): Promise<void> {
  if (globalThis.__heatflowSql) {
    await globalThis.__heatflowSql.end({ timeout: 5 });
    globalThis.__heatflowSql = undefined;
    globalThis.__heatflowDbClient = undefined;
  }
}

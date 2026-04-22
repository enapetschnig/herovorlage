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
  if (!url) throw new Error("DATABASE_URL not set");
  const isPooler = url.includes("pooler.supabase.com");
  const sql = postgres(url, {
    prepare: !isPooler,
    max: isPooler ? 5 : 10,
    idle_timeout: 30,
  });
  globalThis.__heatflowSql = sql;
  return drizzle(sql, { schema, casing: "snake_case" });
}

function getClient(): DrizzleDb {
  return globalThis.__heatflowDbClient ?? (globalThis.__heatflowDbClient = buildClient());
}

/**
 * Lazy singleton — the connection is only opened on first property access, never at import
 * time. This lets `next build` prerender pages that don't hit the DB without needing
 * DATABASE_URL at build time.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Db = DrizzleDb;

export { schema };

export async function closeDb(): Promise<void> {
  if (globalThis.__heatflowSql) {
    await globalThis.__heatflowSql.end({ timeout: 5 });
    globalThis.__heatflowSql = undefined;
    globalThis.__heatflowDbClient = undefined;
  }
}

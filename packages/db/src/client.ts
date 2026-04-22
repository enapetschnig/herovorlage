import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

declare global {
  // eslint-disable-next-line no-var
  var __heatflowDbClient: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __heatflowSql: ReturnType<typeof postgres> | undefined;
}

function buildClient() {
  const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  // For Supabase pooler we want prepare:false (transaction mode)
  const isPooler = url.includes("pooler.supabase.com");
  const sql = postgres(url, {
    prepare: !isPooler,
    max: isPooler ? 5 : 10,
    idle_timeout: 30,
  });
  globalThis.__heatflowSql = sql;
  return drizzle(sql, { schema, casing: "snake_case" });
}

/** Singleton — survives Next.js HMR. */
export const db = globalThis.__heatflowDbClient ?? (globalThis.__heatflowDbClient = buildClient());

export type Db = typeof db;

export { schema };

export async function closeDb(): Promise<void> {
  if (globalThis.__heatflowSql) {
    await globalThis.__heatflowSql.end({ timeout: 5 });
    globalThis.__heatflowSql = undefined;
    globalThis.__heatflowDbClient = undefined;
  }
}

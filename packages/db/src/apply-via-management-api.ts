/**
 * Applies SQL files in `drizzle/` to a Supabase project via the Management API.
 *
 * Usage:
 *   tsx src/apply-via-management-api.ts            # apply all *.sql in drizzle/
 *   tsx src/apply-via-management-api.ts file.sql   # apply a single file
 *
 * Why not Drizzle's normal push? — We don't have the Postgres password locally yet,
 * but we do have a Supabase Management Token that lets us POST raw SQL to the project.
 * This script is the bootstrap path. Once the user pastes the DB password into
 * .env.local, normal drizzle-kit push works too.
 */
import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const projectRef = requireEnv("SUPABASE_PROJECT_REF");
const token = requireEnv("SUPABASE_MANAGEMENT_TOKEN");

async function runSql(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }
  return res.json().catch(() => null);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set in env`);
  return v;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  const drizzleDir = join(__dirname, "..", "drizzle");

  let files: string[];
  if (arg) {
    files = [arg];
  } else {
    const all = await readdir(drizzleDir);
    files = all.filter((f) => f.endsWith(".sql")).sort();
  }

  for (const f of files) {
    const path = arg ? f : join(drizzleDir, f);
    const sql = await readFile(path, "utf8");
    process.stdout.write(`Applying ${f} ... `);
    try {
      await runSql(sql);
      console.log("OK");
    } catch (e) {
      console.log("FAIL");
      console.error(e);
      process.exit(1);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

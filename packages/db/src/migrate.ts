/**
 * Standard Drizzle migrator — needs a real DATABASE_URL with the Postgres password.
 *
 * If you don't have the DB password yet, use the bootstrap script instead:
 *   pnpm --filter @heatflow/db db:apply-via-mgmt
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("REPLACE_ME")) {
    console.error(
      "DATABASE_URL not set or still has REPLACE_ME placeholder.\n" +
        "Either paste the Postgres password from the Supabase dashboard into .env.local,\n" +
        "or run: pnpm --filter @heatflow/db db:apply-via-mgmt",
    );
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

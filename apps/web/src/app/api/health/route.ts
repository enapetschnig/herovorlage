import { NextResponse } from "next/server";
import { db, schema } from "@heatflow/db";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const start = Date.now();
    const [{ tenants }] = await db.select({ tenants: count() }).from(schema.tenants);
    return NextResponse.json({
      status: "ok",
      tenants: Number(tenants ?? 0),
      latencyMs: Date.now() - start,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { status: "error", error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

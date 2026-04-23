import { NextResponse } from "next/server";
import { getTrpcCaller } from "@/server/trpc";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const trpc = await getTrpcCaller();
    results.callerCreated = true;

    try {
      const tenant = await trpc.tenant.current();
      results["tenant.current"] = { ok: true, tenant };
    } catch (e) {
      results["tenant.current"] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join("\n") : null,
      };
    }

    try {
      const overview = await trpc.dashboard.overview();
      results["dashboard.overview"] = { ok: true, kpis: overview.kpis };
    } catch (e) {
      results["dashboard.overview"] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join("\n") : null,
      };
    }

    try {
      const contacts = await trpc.contacts.list({ limit: 1 });
      results["contacts.list"] = { ok: true, count: contacts.items?.length ?? 0 };
    } catch (e) {
      results["contacts.list"] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join("\n") : null,
      };
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json(
      {
        ...results,
        fatalError: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
      },
      { status: 500 },
    );
  }
}

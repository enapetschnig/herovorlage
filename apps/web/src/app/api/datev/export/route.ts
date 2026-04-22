import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@heatflow/auth";
import { db, schema } from "@heatflow/db";
import { loadDatevBookings } from "@heatflow/api/services/document-render";
import { renderDatevCsv } from "@heatflow/integrations-datev";
import { and, eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const sr = (sp.get("sr") ?? "SKR03") as "SKR03" | "SKR04";

  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return NextResponse.json({ error: "from (YYYY-MM-DD) required" }, { status: 400 });
  if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "to (YYYY-MM-DD) required" }, { status: 400 });

  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(and(eq(schema.tenants.id, session.user.tenantId)))
    .limit(1);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { bookings } = await loadDatevBookings(db, session.user.tenantId, { fromDate: from, toDate: to, sr });

  const fiscalYearStart = from.slice(0, 4) + "0101";
  const csv = renderDatevCsv(bookings, {
    clientName: tenant.name,
    fiscalYearStart,
    recordedFrom: from.replace(/-/g, ""),
    recordedUntil: to.replace(/-/g, ""),
    accountLength: 4,
  });

  const filename = `DATEV_${tenant.slug}_${from}_${to}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=windows-1252",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

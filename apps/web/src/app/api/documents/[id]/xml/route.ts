import { NextResponse } from "next/server";
import { auth } from "@heatflow/auth";
import { db } from "@heatflow/db";
import { renderXRechnungXml } from "@heatflow/integrations-zugferd";
import { loadRenderInput } from "@heatflow/api/services/document-render";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let data;
  try {
    data = await loadRenderInput(db, session.user.tenantId, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Not found" }, { status: 404 });
  }

  const xml = renderXRechnungXml(data);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.document.number}-xrechnung.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@heatflow/auth";
import { db } from "@heatflow/db";
import { renderDocumentPdf } from "@heatflow/pdf";
import { loadRenderInput } from "@heatflow/api/services/document-render";

// React-PDF needs Node runtime (not edge).
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let data;
  try {
    data = await loadRenderInput(db, session.user.tenantId, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Not found" }, { status: 404 });
  }

  const buffer = await renderDocumentPdf(data);
  const inline = req.nextUrl.searchParams.get("download") !== "1";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${data.document.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

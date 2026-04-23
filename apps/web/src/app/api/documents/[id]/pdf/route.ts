import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@heatflow/auth";
import { db } from "@heatflow/db";
import { renderDocumentPdf } from "@heatflow/pdf";
import { loadRenderInput } from "@heatflow/api/services/document-render";

// React-PDF needs Node runtime (not edge).
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;

    let data;
    try {
      data = await loadRenderInput(db, session.user.tenantId, id);
    } catch (e) {
      return NextResponse.json(
        {
          error: "load_failed",
          message: e instanceof Error ? e.message : String(e),
        },
        { status: 404 },
      );
    }

    let buffer;
    try {
      buffer = await renderDocumentPdf(data);
    } catch (e) {
      console.error("[PDF] render failed:", e);
      return NextResponse.json(
        {
          error: "render_failed",
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack?.split("\n").slice(0, 10).join("\n") : null,
        },
        { status: 500 },
      );
    }

    const inline = req.nextUrl.searchParams.get("download") !== "1";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${data.document.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[PDF] unexpected error:", e);
    return NextResponse.json(
      {
        error: "unexpected",
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 15).join("\n") : null,
      },
      { status: 500 },
    );
  }
}

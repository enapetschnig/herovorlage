import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@heatflow/auth";
import { db, schema } from "@heatflow/db";
import { assistantStream, type ChatMessage } from "@heatflow/ai";
import { and, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  messages: ChatMessage[];
  pageContext?: { kind: "project" | "contact" | "document" | "page"; id?: string; pathname?: string };
};

// Demo replies for when ANTHROPIC_API_KEY is missing — keeps the demo UX flowing.
const DEMO_REPLIES = [
  "Klar, hier ein Vorschlag: Du könntest direkt die nächste Wartung beim Kunden Steiner für 20.08.2026 planen — der Vertrag ist auto-erneuert, Vitocal 350-A, Intervall 12 Monate.",
  "Das offene Angebot AN-2026-001 beträgt €31.320 brutto. Für ein schnelleres Approval kannst du dem Kunden den Förderhinweis (Raus-aus-Öl-Bonus, €7.500) im Anschreiben mitschicken.",
  "Aus dem Foto-zu-Angebot-Flow kommt die Empfehlung Vitocal 350-G 10kW + Pufferspeicher 800L. Soll ich dir eine Position-Liste für ein Folgeangebot zusammenstellen?",
  "Als Wartungsintervall für die Vitocal 350-A im Alpenhotel ist 12 Monate hinterlegt. Letzte Wartung: 17.04.2025. Nächster fälliger Termin: 20.08.2026 — also in ca. 4 Monaten.",
  "Für DATEV-Export im Q1: 1 Rechnung à €31.320 würde übergehen. Tipp: Der Beleg muss vor Export 'abgeschlossen' sein (locked). Aktuell ist AN-2026-001 noch ein Angebot — erst zur Rechnung wandeln.",
];

function pickDemoReply(messages: ChatMessage[]): string {
  const lastUser = messages.filter((m) => m.role === "user").pop()?.content.toLowerCase() ?? "";
  if (lastUser.includes("wartung") || lastUser.includes("alpenhotel")) return DEMO_REPLIES[3]!;
  if (lastUser.includes("datev") || lastUser.includes("export") || lastUser.includes("steuer")) return DEMO_REPLIES[4]!;
  if (lastUser.includes("foto") || lastUser.includes("vitocal") || lastUser.includes("vorschlag")) return DEMO_REPLIES[2]!;
  if (lastUser.includes("angebot") || lastUser.includes("rechnung")) return DEMO_REPLIES[1]!;
  return DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)]!;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const { messages = [], pageContext } = body;

  const [tenant] = await db
    .select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, session.user.tenantId))
    .limit(1);

  // Resolve page context to a small JSON snapshot so the model knows what user is looking at
  const ctxData = await loadPageContext(session.user.tenantId, pageContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("status", { mode: process.env.ANTHROPIC_API_KEY ? "live" : "demo" });

        if (!process.env.ANTHROPIC_API_KEY) {
          // Demo: stream a canned reply token-by-token for that real-feel
          const reply = pickDemoReply(messages);
          for (const ch of reply) {
            send("token", { text: ch });
            await new Promise((r) => setTimeout(r, 12));
          }
          send("done", { tokens: reply.length });
        } else {
          const stream$ = assistantStream(messages, {
            user: { id: session.user.id, name: session.user.name ?? "User", role: session.user.role ?? "technician" },
            tenant: { id: session.user.tenantId, name: tenant?.name ?? "Tenant" },
            page: ctxData,
          });
          let total = 0;
          for await (const token of stream$) {
            send("token", { text: token });
            total += token.length;
          }
          send("done", { tokens: total });
        }
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function loadPageContext(
  tenantId: string,
  ctx?: Body["pageContext"],
): Promise<Record<string, unknown> | undefined> {
  if (!ctx?.id) return ctx?.pathname ? { pathname: ctx.pathname } : undefined;

  if (ctx.kind === "project") {
    const [p] = await db
      .select({
        number: schema.projects.number,
        title: schema.projects.title,
        status: schema.projects.status,
        trade: schema.projects.trade,
        potentialValue: schema.projects.potentialValue,
        description: schema.projects.description,
      })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, ctx.id), eq(schema.projects.tenantId, tenantId), isNull(schema.projects.deletedAt)))
      .limit(1);
    return p ? { entity: "project", ...p } : undefined;
  }

  if (ctx.kind === "contact") {
    const [c] = await db
      .select({
        customerNumber: schema.contacts.customerNumber,
        type: schema.contacts.type,
        kind: schema.contacts.kind,
        companyName: schema.contacts.companyName,
        firstName: schema.contacts.firstName,
        lastName: schema.contacts.lastName,
        email: schema.contacts.email,
        notes: schema.contacts.notes,
      })
      .from(schema.contacts)
      .where(and(eq(schema.contacts.id, ctx.id), eq(schema.contacts.tenantId, tenantId), isNull(schema.contacts.deletedAt)))
      .limit(1);
    return c ? { entity: "contact", ...c } : undefined;
  }

  if (ctx.kind === "document") {
    const [d] = await db
      .select({
        number: schema.documents.number,
        type: schema.documents.type,
        status: schema.documents.status,
        totalGross: schema.documents.totalGross,
        title: schema.documents.title,
      })
      .from(schema.documents)
      .where(and(eq(schema.documents.id, ctx.id), eq(schema.documents.tenantId, tenantId), isNull(schema.documents.deletedAt)))
      .limit(1);
    return d ? { entity: "document", ...d } : undefined;
  }

  return { pathname: ctx.pathname };
}

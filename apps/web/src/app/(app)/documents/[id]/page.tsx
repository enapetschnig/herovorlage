import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, StatusBadge } from "@heatflow/ui";
import { formatDate, formatMoney } from "@heatflow/utils";
import { Copy, FileText, Lock, Pencil } from "lucide-react";
import { DocumentActions } from "../_components/DocumentActions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  quote: "Angebot",
  order_confirmation: "Auftragsbestätigung",
  delivery_note: "Lieferschein",
  invoice: "Rechnung",
  partial_invoice: "Teilrechnung",
  final_invoice: "Schlussrechnung",
  credit_note: "Gutschrift",
};

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getTrpcCaller();
  let doc;
  try { doc = await trpc.documents.byId({ id }); } catch { notFound(); }
  const tenant = await trpc.tenant.current();

  const contactName =
    doc.contact?.companyName ?? `${doc.contact?.firstName ?? ""} ${doc.contact?.lastName ?? ""}`.trim() || "—";

  // VAT breakdown
  const vatBreakdown = new Map<number, { net: number; vat: number }>();
  for (const p of doc.positions) {
    if (p.kind !== "article" && p.kind !== "service") continue;
    const rate = Number(p.vatPct);
    const net = Number(p.totalNet);
    const cur = vatBreakdown.get(rate) ?? { net: 0, vat: 0 };
    cur.net += net;
    cur.vat += net * (rate / 100);
    vatBreakdown.set(rate, cur);
  }

  return (
    <>
      <PageHeader
        title={doc.title ?? doc.number}
        description={`${TYPE_LABEL[doc.type]} · ${doc.number} · ${contactName}`}
        actions={
          <>
            {!doc.locked && (
              <Link href={`/documents/${doc.id}/edit`}>
                <Button variant="secondary"><Pencil className="size-4" /> Bearbeiten</Button>
              </Link>
            )}
            <DocumentActions docId={doc.id} type={doc.type} locked={doc.locked} contactEmail={doc.contact?.email ?? null} />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusBadge status={doc.status} />
          {doc.locked && <Badge tone="neutral"><Lock className="size-3 inline mr-1" /> Abgeschlossen</Badge>}
          <Badge tone="primary">Brutto: {formatMoney(Number(doc.totalGross), { currency: doc.currency as "EUR" | "CHF" })}</Badge>
        </div>
      </PageHeader>

      <div className="p-6 max-w-5xl mx-auto">
        {/* Document preview, A4-ish look */}
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          {/* Header: sender + recipient + meta */}
          <div className="p-8 grid sm:grid-cols-2 gap-6 border-b border-border">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-fg mb-2">Absender</div>
              <div className="font-semibold">{tenant?.name}</div>
              <div className="text-sm text-muted-fg whitespace-pre-line">
                {[tenant?.addressStreet, `${tenant?.addressZip ?? ""} ${tenant?.addressCity ?? ""}`.trim(), tenant?.country].filter(Boolean).join("\n")}
              </div>
              {tenant?.email && <div className="text-sm text-muted-fg mt-1">{tenant.email}</div>}
              {tenant?.vatId && <div className="text-xs text-muted-fg mt-1">UID: {tenant.vatId}</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-fg mb-2">Empfänger</div>
              <div className="font-semibold">{contactName}</div>
              <div className="text-sm text-muted-fg">
                {doc.contact?.email && <div>{doc.contact.email}</div>}
                {doc.contact?.phone && <div>{doc.contact.phone}</div>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Meta label="Nummer" value={doc.number} />
                <Meta label="Datum" value={formatDate(doc.documentDate)} />
                {doc.dueDate && <Meta label="Fällig" value={formatDate(doc.dueDate)} />}
                <Meta label="Typ" value={TYPE_LABEL[doc.type] ?? doc.type} />
              </div>
            </div>
          </div>

          {/* Intro text */}
          {doc.introText && (
            <div className="px-8 py-5 border-b border-border whitespace-pre-line text-sm">
              {doc.introText}
            </div>
          )}

          {/* Positions table */}
          <div className="px-8 py-5">
            <table className="w-full text-sm">
              <thead className="border-b-2 border-border">
                <tr className="text-xs uppercase tracking-wider text-muted-fg">
                  <th className="text-left py-2 w-[60px]">Pos.</th>
                  <th className="text-left py-2">Bezeichnung</th>
                  <th className="text-right py-2 w-[80px]">Menge</th>
                  <th className="text-left py-2 w-[60px]">Einheit</th>
                  <th className="text-right py-2 w-[100px]">EP</th>
                  <th className="text-right py-2 w-[100px]">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {doc.positions.map((p) => {
                  if (p.kind === "title") {
                    return (
                      <tr key={p.id} className="border-b border-border">
                        <td colSpan={6} className="pt-5 pb-2 font-semibold text-base">{p.description}</td>
                      </tr>
                    );
                  }
                  if (p.kind === "text") {
                    return (
                      <tr key={p.id} className="border-b border-border">
                        <td colSpan={6} className="py-2 text-muted-fg italic">{p.description}</td>
                      </tr>
                    );
                  }
                  if (p.kind === "subtotal") {
                    return (
                      <tr key={p.id} className="border-y border-border bg-muted/30 font-medium">
                        <td colSpan={5} className="py-2 px-2 text-right">Zwischensumme</td>
                        <td className="py-2 text-right tabular-nums">{formatMoney(Number(p.totalNet))}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={p.id} className="border-b border-border align-top">
                      <td className="py-2 text-muted-fg font-mono text-xs">{p.positionNumber}</td>
                      <td className="py-2 whitespace-pre-line">{p.description}</td>
                      <td className="py-2 text-right tabular-nums">{Number(p.quantity)}</td>
                      <td className="py-2">{p.unit}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(Number(p.unitPrice))}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{formatMoney(Number(p.totalNet))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-6 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-fg">Nettobetrag</span>
                  <span className="tabular-nums">{formatMoney(Number(doc.totalNet))}</span>
                </div>
                {Array.from(vatBreakdown.entries()).sort(([a], [b]) => a - b).map(([rate, v]) => (
                  <div key={rate} className="flex justify-between text-muted-fg">
                    <span>USt. {rate} %</span>
                    <span className="tabular-nums">{formatMoney(v.vat)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t-2 border-border pt-2 mt-2 font-semibold text-base">
                  <span>Gesamt</span>
                  <span className="tabular-nums">{formatMoney(Number(doc.totalGross))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Closing text */}
          {doc.closingText && (
            <div className="px-8 py-5 border-t border-border whitespace-pre-line text-sm">
              {doc.closingText}
            </div>
          )}
        </div>

        {/* Side info */}
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <Card>
            <CardHeader><CardTitle>Verlauf</CardTitle></CardHeader>
            <CardContent className="text-xs text-muted-fg space-y-1.5">
              <div>Erstellt: {formatDate(doc.createdAt)}</div>
              {doc.sentAt && <div>Gesendet: {formatDate(doc.sentAt)}</div>}
              {doc.lockedAt && <div>Abgeschlossen: {formatDate(doc.lockedAt)}</div>}
              {doc.referenceDocumentId && <div>Referenz: {doc.referenceDocumentId}</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Verknüpfungen</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {doc.contact && (
                <div>
                  <div className="text-xs text-muted-fg">Kontakt</div>
                  <Link href={`/contacts/${doc.contact.id}`} className="hover:underline">{contactName}</Link>
                </div>
              )}
              {doc.projectId && (
                <div>
                  <div className="text-xs text-muted-fg">Projekt</div>
                  <Link href={`/projects/${doc.projectId}`} className="hover:underline">Projekt öffnen</Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-fg">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

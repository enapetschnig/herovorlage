import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Button, DataTable, EmptyState, PageHeader, StatusBadge } from "@heatflow/ui";
import { Download, Eye, FileText, Lock, Plus, Search } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@heatflow/utils/constants";
import { cn } from "@heatflow/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  quote: "Angebot",
  order_confirmation: "Auftragsbest.",
  delivery_note: "Lieferschein",
  invoice: "Rechnung",
  partial_invoice: "Teilrechnung",
  final_invoice: "Schlussrechnung",
  credit_note: "Gutschrift",
};

const TYPE_TONE: Record<string, "neutral" | "primary" | "accent" | "success" | "warning"> = {
  quote: "primary",
  order_confirmation: "accent",
  delivery_note: "neutral",
  invoice: "success",
  partial_invoice: "success",
  final_invoice: "success",
  credit_note: "warning",
};

const QUICK_FILTERS = [
  { key: "", label: "Alle" },
  { key: "quote", label: "Angebote" },
  { key: "invoice", label: "Rechnungen" },
  { key: "delivery_note", label: "Lieferscheine" },
  { key: "credit_note", label: "Gutschriften" },
] as const;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const page = sp.page ? Number(sp.page) : 1;
  const data = await trpc.documents.list({
    page,
    pageSize: 50,
    sortDir: "desc",
    search: sp.q,
    type: DOCUMENT_TYPES.includes(sp.type as (typeof DOCUMENT_TYPES)[number]) ? (sp.type as (typeof DOCUMENT_TYPES)[number]) : undefined,
    status: DOCUMENT_STATUSES.includes(sp.status as (typeof DOCUMENT_STATUSES)[number]) ? (sp.status as (typeof DOCUMENT_STATUSES)[number]) : undefined,
  });

  return (
    <>
      <PageHeader
        title="Dokumente"
        description={`${data.total} Einträge insgesamt — Angebote, Rechnungen, Lieferscheine und mehr.`}
        actions={
          <Link href="/documents/new">
            <Button><Plus className="size-4" /> Neues Dokument</Button>
          </Link>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {/* Quick filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {QUICK_FILTERS.map((f) => {
            const active = (sp.type ?? "") === f.key;
            const queryString = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(f.key ? { type: f.key } : {}) }).toString();
            return (
              <Link
                key={f.key}
                href={`/documents${queryString ? `?${queryString}` : ""}`}
                className={cn(
                  "px-3 h-8 inline-flex items-center rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                  active
                    ? "bg-primary text-primary-fg border-primary shadow-sm"
                    : "bg-card border-border hover:bg-muted hover:border-border/80",
                )}
              >
                {f.label}
              </Link>
            );
          })}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <form method="get" className="relative">
              {sp.type && <input type="hidden" name="type" value={sp.type} />}
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-fg pointer-events-none" />
              <input
                type="search"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Suche Nummer, Titel…"
                className="w-56 h-9 pl-8 pr-3 rounded-md border border-input bg-card text-sm placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-1 focus:ring-offset-bg"
              />
            </form>
          </div>
        </div>

        {/* Main table */}
        <div className="rounded-xl overflow-hidden">
          <DataTable
            rows={data.items}
            rowKey={(d) => d.id}
            empty={
              <EmptyState
                icon={<FileText className="size-5" />}
                title="Noch keine Dokumente"
                description="Erstes Angebot anlegen — vom Angebot zur Rechnung mit einem Klick."
                action={<Link href="/documents/new"><Button><Plus className="size-4" /> Dokument anlegen</Button></Link>}
              />
            }
            columns={[
              {
                id: "number", header: "Nummer", width: "140px",
                cell: (d) => (
                  <Link href={`/documents/${d.id}`} className="inline-flex items-center gap-2 group">
                    <code className="text-xs font-mono text-fg group-hover:text-primary tabular-nums">{d.number}</code>
                    {d.locked && <Lock className="size-3 text-muted-fg" />}
                  </Link>
                ),
              },
              {
                id: "type", header: "Typ", width: "140px",
                cell: (d) => <Badge tone={TYPE_TONE[d.type] ?? "neutral"}>{TYPE_LABEL[d.type] ?? d.type}</Badge>,
              },
              {
                id: "title", header: "Titel / Kunde",
                cell: (d) => (
                  <div className="min-w-0">
                    <Link href={`/documents/${d.id}`} className="font-medium hover:text-primary truncate block">
                      {d.title ?? d.number}
                    </Link>
                    {d.contactName && (
                      <Link href={`/contacts/${d.contactId}`} className="text-xs text-muted-fg hover:underline truncate block">
                        {d.contactName}
                      </Link>
                    )}
                  </div>
                ),
              },
              {
                id: "date", header: "Datum", width: "110px",
                cell: (d) => <span className="text-xs text-muted-fg tabular-nums">{formatDate(d.documentDate)}</span>,
              },
              {
                id: "status", header: "Status", width: "130px",
                cell: (d) => <StatusBadge status={d.status} />,
              },
              {
                id: "total", header: "Brutto", align: "right", width: "120px",
                cell: (d) => (
                  <span className="tabular-nums font-semibold">
                    {formatMoney(Number(d.totalGross), { currency: d.currency as "EUR" | "CHF" })}
                  </span>
                ),
              },
              {
                id: "actions", header: "", width: "110px", align: "right",
                cell: (d) => (
                  <div className="flex items-center justify-end gap-0.5">
                    <a
                      href={`/api/documents/${d.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      title="PDF öffnen"
                      className="size-8 grid place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg transition-colors"
                    >
                      <Eye className="size-4" />
                    </a>
                    <a
                      href={`/api/documents/${d.id}/pdf?download=1`}
                      title="PDF herunterladen"
                      className="size-8 grid place-items-center rounded-md text-muted-fg hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Download className="size-4" />
                    </a>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </>
  );
}

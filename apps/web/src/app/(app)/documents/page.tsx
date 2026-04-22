import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Button, DataTable, EmptyState, PageHeader, StatusBadge } from "@heatflow/ui";
import { FileText, Plus } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";
import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@heatflow/utils/constants";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  quote: "Angebot",
  order_confirmation: "AB",
  delivery_note: "Lieferschein",
  invoice: "Rechnung",
  partial_invoice: "Teilrechnung",
  final_invoice: "Schlussrechnung",
  credit_note: "Gutschrift",
};

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
        description={`${data.total} Dokumente insgesamt`}
        actions={
          <Link href="/documents/new">
            <Button><Plus className="size-4" /> Neues Dokument</Button>
          </Link>
        }
      >
        <form className="flex gap-2 max-w-3xl pt-2 flex-wrap" method="get">
          <input
            type="search" name="q" defaultValue={sp.q ?? ""}
            placeholder="Suche nach Nummer oder Titel…"
            className="flex-1 min-w-[200px] h-9 px-3 rounded-md border border-input bg-bg text-sm"
          />
          <select name="type" defaultValue={sp.type ?? ""} className="h-9 px-3 rounded-md border border-input bg-bg text-sm">
            <option value="">Alle Typen</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select name="status" defaultValue={sp.status ?? ""} className="h-9 px-3 rounded-md border border-input bg-bg text-sm">
            <option value="">Alle Status</option>
            {DOCUMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </PageHeader>

      <div className="p-6 max-w-7xl mx-auto">
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
            { id: "number", header: "Nummer", width: "130px",
              cell: (d) => <code className="text-xs text-muted-fg">{d.number}</code>,
            },
            { id: "type", header: "Typ", width: "130px",
              cell: (d) => <Badge>{TYPE_LABEL[d.type] ?? d.type}</Badge>,
            },
            { id: "title", header: "Titel",
              cell: (d) => (
                <Link href={`/documents/${d.id}`} className="font-medium hover:underline">
                  {d.title ?? d.number}
                </Link>
              ),
            },
            { id: "contact", header: "Kunde",
              cell: (d) => d.contactName ? (
                <Link href={`/contacts/${d.contactId}`} className="text-sm hover:underline">{d.contactName}</Link>
              ) : <span className="text-muted-fg">—</span>,
            },
            { id: "project", header: "Projekt", width: "160px",
              cell: (d) => d.projectId ? (
                <Link href={`/projects/${d.projectId}`} className="text-sm hover:underline truncate block">{d.projectTitle}</Link>
              ) : <span className="text-muted-fg">—</span>,
            },
            { id: "date", header: "Datum", width: "100px",
              cell: (d) => <span className="text-xs text-muted-fg">{formatDate(d.documentDate)}</span>,
            },
            { id: "status", header: "Status", width: "120px",
              cell: (d) => (
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={d.status} />
                  {d.locked && <span title="Abgeschlossen">🔒</span>}
                </div>
              ),
            },
            { id: "total", header: "Brutto", align: "right", width: "120px",
              cell: (d) => <span className="tabular-nums font-medium">{formatMoney(Number(d.totalGross), { currency: d.currency as "EUR" | "CHF" })}</span>,
            },
          ]}
        />
      </div>
    </>
  );
}

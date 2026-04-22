import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Button, DataTable, EmptyState, PageHeader, StatusBadge } from "@heatflow/ui";
import { Briefcase, Plus } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";
import { PROJECT_STATUSES } from "@heatflow/utils/constants";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const page = sp.page ? Number(sp.page) : 1;
  const data = await trpc.projects.list({
    page,
    pageSize: 50,
    sortBy: "createdAt",
    sortDir: "desc",
    search: sp.q,
    status: PROJECT_STATUSES.includes(sp.status as (typeof PROJECT_STATUSES)[number])
      ? (sp.status as (typeof PROJECT_STATUSES)[number])
      : undefined,
  });

  return (
    <>
      <PageHeader
        title="Projekte"
        description={`${data.total} Projekte insgesamt`}
        actions={
          <>
            <Link href="/projects/kanban">
              <Button variant="secondary">Kanban</Button>
            </Link>
            <Link href="/projects/new">
              <Button><Plus className="size-4" /> Neues Projekt</Button>
            </Link>
          </>
        }
      >
        <form className="flex gap-2 max-w-2xl pt-2" method="get">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Suche nach Titel oder Nummer…"
            className="flex-1 h-9 px-3 rounded-md border border-input bg-bg text-sm"
          />
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="h-9 px-3 rounded-md border border-input bg-bg text-sm"
          >
            <option value="">Alle Status</option>
            {PROJECT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </PageHeader>

      <div className="p-6 max-w-7xl mx-auto">
        <DataTable
          rows={data.items}
          rowKey={(p) => p.id}
          empty={
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title="Noch keine Projekte"
              description="Erstes Projekt jetzt anlegen."
              action={<Link href="/projects/new"><Button><Plus className="size-4" /> Projekt anlegen</Button></Link>}
            />
          }
          columns={[
            { id: "number", header: "Nummer", width: "130px",
              cell: (p) => <code className="text-xs text-muted-fg">{p.number}</code>,
            },
            { id: "title", header: "Titel",
              cell: (p) => (
                <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
              ),
            },
            { id: "contact", header: "Kunde",
              cell: (p) => p.contactName ? (
                <Link href={`/contacts/${p.contactId}`} className="text-sm hover:underline">{p.contactName}</Link>
              ) : <span className="text-muted-fg">—</span>,
            },
            { id: "status", header: "Status", width: "130px",
              cell: (p) => <StatusBadge status={p.status} />,
            },
            { id: "value", header: "Potential", align: "right", width: "130px",
              cell: (p) => p.potentialValue ? <span className="tabular-nums">{formatMoney(Number(p.potentialValue))}</span> : <span className="text-muted-fg">—</span>,
            },
            { id: "responsible", header: "Verantwortlich", width: "150px",
              cell: (p) => p.responsibleUserName ?? <span className="text-muted-fg">—</span>,
            },
            { id: "created", header: "Angelegt", width: "120px",
              cell: (p) => <span className="text-xs text-muted-fg">{formatDate(p.createdAt)}</span>,
            },
          ]}
        />
      </div>
    </>
  );
}

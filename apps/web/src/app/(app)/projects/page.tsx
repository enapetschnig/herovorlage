import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Button, DataTable, EmptyState, PageHeader, StatusBadge, Badge } from "@heatflow/ui";
import { Briefcase, Filter, Plus, X } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";
import { PROJECT_STATUSES } from "@heatflow/utils/constants";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; stage?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const page = sp.page ? Number(sp.page) : 1;

  // Special: ?stage=__unassigned__ → projects without a pipeline stage
  const stageFilter = sp.stage;
  const wantsUnassigned = stageFilter === "__unassigned__";

  const data = await trpc.projects.list({
    page,
    pageSize: 50,
    sortBy: "createdAt",
    sortDir: "desc",
    search: sp.q,
    status: PROJECT_STATUSES.includes(sp.status as (typeof PROJECT_STATUSES)[number])
      ? (sp.status as (typeof PROJECT_STATUSES)[number])
      : undefined,
    pipelineStage: stageFilter && !wantsUnassigned ? stageFilter : undefined,
  });

  // Client-side filter for unassigned (no DB "is null" input right now)
  const rows = wantsUnassigned
    ? data.items.filter((p) => !p.pipelineStage)
    : data.items;

  const headerTitle = stageFilter
    ? wantsUnassigned
      ? "Projekte ohne Pipeline-Stufe"
      : `Pipeline — ${stageFilter}`
    : "Projekte";
  const headerDescription = stageFilter
    ? `${rows.length} Projekte in dieser Stufe`
    : `${data.total} Projekte insgesamt`;

  return (
    <>
      <PageHeader
        title={headerTitle}
        description={headerDescription}
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
      />

      <div className="p-6 max-w-7xl mx-auto space-y-4">
        {/* Active stage filter chip */}
        {stageFilter && (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 h-8 pl-3 pr-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-sm">
              <Filter className="size-3.5" />
              <span className="font-medium">{wantsUnassigned ? "Ohne Stufe" : stageFilter}</span>
              <Link
                href="/projects"
                className="size-6 grid place-items-center rounded-full hover:bg-primary/20 transition-colors ml-0.5"
                title="Filter entfernen"
              >
                <X className="size-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Search + filter form */}
        <form className="flex gap-2 max-w-2xl" method="get">
          {stageFilter && <input type="hidden" name="stage" value={stageFilter} />}
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Suche nach Titel oder Nummer…"
            className="flex-1 h-9 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-1 focus:ring-offset-bg"
          />
          <Button type="submit" variant="secondary">Suchen</Button>
        </form>

        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          empty={
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title={stageFilter ? "Keine Projekte in dieser Stufe" : "Noch keine Projekte"}
              description={stageFilter ? "Sobald du Projekte in diese Stufe rückst, erscheinen sie hier." : "Erstes Projekt jetzt anlegen."}
              action={<Link href="/projects/new"><Button><Plus className="size-4" /> Projekt anlegen</Button></Link>}
            />
          }
          columns={[
            {
              id: "number", header: "Nummer", width: "130px",
              cell: (p) => <code className="text-xs font-mono text-muted-fg tabular-nums">{p.number}</code>,
            },
            {
              id: "title", header: "Titel",
              cell: (p) => (
                <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">{p.title}</Link>
              ),
            },
            {
              id: "contact", header: "Kunde",
              cell: (p) => p.contactName ? (
                <Link href={`/contacts/${p.contactId}`} className="text-sm hover:underline">{p.contactName}</Link>
              ) : <span className="text-muted-fg">—</span>,
            },
            {
              id: "stage", header: "Pipeline", width: "170px",
              cell: (p) => p.pipelineStage ? (
                <Badge tone="primary">{p.pipelineStage}</Badge>
              ) : <span className="text-xs text-muted-fg italic">—</span>,
            },
            {
              id: "status", header: "Status", width: "130px",
              cell: (p) => <StatusBadge status={p.status} />,
            },
            {
              id: "value", header: "Potential", align: "right", width: "120px",
              cell: (p) => p.potentialValue ? <span className="tabular-nums font-medium">{formatMoney(Number(p.potentialValue))}</span> : <span className="text-muted-fg">—</span>,
            },
            {
              id: "created", header: "Angelegt", width: "110px",
              cell: (p) => <span className="text-xs text-muted-fg tabular-nums">{formatDate(p.createdAt)}</span>,
            },
          ]}
        />
      </div>
    </>
  );
}

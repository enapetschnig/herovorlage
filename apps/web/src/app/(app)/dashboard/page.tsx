import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, StatusBadge } from "@heatflow/ui";
import { formatMoney, formatAgo, formatDate } from "@heatflow/utils";
import { Briefcase, CheckSquare, FileWarning, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const trpc = await getTrpcCaller();
  const [tenant, data] = await Promise.all([trpc.tenant.current(), trpc.dashboard.overview()]);

  return (
    <>
      <PageHeader
        title={`Übersicht — ${tenant?.name ?? "Betrieb"}`}
        description="Was heute zählt, auf einen Blick."
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Kontakte" value={data.kpis.contacts} icon={<Users className="size-5" />} />
          <KpiCard label="Aktive Projekte" value={data.kpis.activeProjects} icon={<Briefcase className="size-5" />} />
          <KpiCard label="Offene Aufgaben" value={data.kpis.openTasks} icon={<CheckSquare className="size-5" />} />
          <KpiCard
            label="Überfällige Rechnungen"
            value={data.kpis.overdueInvoices}
            icon={<FileWarning className="size-5" />}
            tone={data.kpis.overdueInvoices > 0 ? "danger" : "neutral"}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Projekt-Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pipeline.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title="Noch keine Projekte"
                description="Lege dein erstes Projekt unter Projekte → Neu an."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {data.pipeline.map((p) => (
                  <Link
                    key={p.status}
                    href={`/projects?status=${p.status}`}
                    className="block rounded-lg border border-border p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    <StatusBadge status={p.status} />
                    <div className="mt-2 text-2xl font-semibold">{p.count}</div>
                    <div className="text-xs text-muted-fg mt-0.5">
                      {p.potentialValue > 0 ? formatMoney(p.potentialValue) : "—"} Potential
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Meine offenen Aufgaben</CardTitle>
            </CardHeader>
            <CardContent>
              {data.myTasks.length === 0 ? (
                <p className="text-sm text-muted-fg py-6 text-center">
                  Alles erledigt — gönn dir einen Kaffee.
                </p>
              ) : (
                <ul className="divide-y divide-border -mx-2">
                  {data.myTasks.map((t) => (
                    <li key={t.id} className="px-2 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={t.projectId ? `/projects/${t.projectId}` : "/tasks"}
                          className="text-sm font-medium hover:underline"
                        >
                          {t.title}
                        </Link>
                        {t.projectTitle && (
                          <div className="text-xs text-muted-fg truncate">{t.projectTitle}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {t.priority === "urgent" && <Badge tone="danger">Dringend</Badge>}
                        {t.priority === "high" && <Badge tone="warning">Hoch</Badge>}
                        {t.dueDate && (
                          <div className="text-xs text-muted-fg mt-1">
                            {formatDate(t.dueDate)}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Letzte Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentLogbook.length === 0 ? (
                <p className="text-sm text-muted-fg py-6 text-center">Noch nichts passiert.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recentLogbook.map((e) => (
                    <li key={e.id} className="flex items-start gap-3">
                      <div className="size-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{e.message}</div>
                        <div className="text-xs text-muted-fg mt-0.5">
                          {e.authorName ?? "System"} · {formatAgo(e.occurredAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label, value, icon, tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-fg">{label}</div>
          <div className={`text-3xl font-semibold mt-1 ${tone === "danger" && value > 0 ? "text-danger" : ""}`}>
            {value}
          </div>
        </div>
        <div className={`size-10 rounded-lg grid place-items-center ${tone === "danger" && value > 0 ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

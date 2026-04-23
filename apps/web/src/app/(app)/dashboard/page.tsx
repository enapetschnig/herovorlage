import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, StatusBadge } from "@heatflow/ui";
import { formatMoney, formatAgo, formatDate } from "@heatflow/utils";
import { Briefcase, CheckSquare, FileWarning, Users, ArrowUpRight, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const trpc = await getTrpcCaller();
  const [tenant, data] = await Promise.all([trpc.tenant.current(), trpc.dashboard.overview()]);

  const greeting = getGreeting();

  return (
    <>
      <PageHeader
        title={`${greeting} — ${tenant?.name ?? "Betrieb"}`}
        description="Was heute zählt, auf einen Blick."
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Kontakte"
            value={data.kpis.contacts}
            icon={<Users className="size-5" />}
            accent="blue"
            href="/contacts"
          />
          <KpiCard
            label="Aktive Projekte"
            value={data.kpis.activeProjects}
            icon={<Briefcase className="size-5" />}
            accent="violet"
            href="/projects"
          />
          <KpiCard
            label="Offene Aufgaben"
            value={data.kpis.openTasks}
            icon={<CheckSquare className="size-5" />}
            accent="amber"
            href="/tasks"
          />
          <KpiCard
            label="Überfällige Rechnungen"
            value={data.kpis.overdueInvoices}
            icon={<FileWarning className="size-5" />}
            accent={data.kpis.overdueInvoices > 0 ? "red" : "green"}
            href="/reminders"
          />
        </div>

        {/* Pipeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Projekt-Pipeline</CardTitle>
              <Link
                href="/projects"
                className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1 transition-colors"
              >
                Alle Projekte <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.pipeline.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="size-5" />}
                title="Noch keine Projekte"
                description="Lege dein erstes Projekt unter Projekte → Neu an."
              />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {data.pipeline.map((p) => (
                  <Link
                    key={p.status}
                    href={`/projects?status=${p.status}`}
                    className="group block rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-4"
                  >
                    <StatusBadge status={p.status} />
                    <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{p.count}</div>
                    <div className="text-xs text-muted-fg mt-1 tabular-nums">
                      {p.potentialValue > 0 ? formatMoney(p.potentialValue) : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* My tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Meine offenen Aufgaben</CardTitle>
                <Link
                  href="/tasks"
                  className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1 transition-colors"
                >
                  Alle <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.myTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="size-10 mx-auto rounded-full bg-success/10 grid place-items-center mb-2">
                    <Sparkles className="size-5 text-success" />
                  </div>
                  <p className="text-sm font-medium">Alles erledigt!</p>
                  <p className="text-xs text-muted-fg mt-1">Gönn dir einen Kaffee.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.myTasks.map((t) => (
                    <li key={t.id} className="px-6 py-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="min-w-0">
                        <Link
                          href={t.projectId ? `/projects/${t.projectId}` : "/tasks"}
                          className="text-sm font-medium hover:underline underline-offset-2"
                        >
                          {t.title}
                        </Link>
                        {t.projectTitle && (
                          <div className="text-xs text-muted-fg truncate mt-0.5">{t.projectTitle}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        {t.priority === "urgent" && <Badge tone="danger">Dringend</Badge>}
                        {t.priority === "high" && <Badge tone="warning">Hoch</Badge>}
                        {t.dueDate && (
                          <div className="text-xs text-muted-fg tabular-nums">{formatDate(t.dueDate)}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle>Letzte Aktivitäten</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentLogbook.length === 0 ? (
                <p className="text-sm text-muted-fg py-10 text-center">Noch nichts passiert.</p>
              ) : (
                <ul className="relative">
                  {data.recentLogbook.map((e, idx) => (
                    <li key={e.id} className="relative flex gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                      {/* Connector line */}
                      {idx < data.recentLogbook.length - 1 && (
                        <div className="absolute left-[30px] top-7 bottom-0 w-px bg-border" />
                      )}
                      <div className="flex-shrink-0 relative z-10 mt-1.5">
                        <div className="size-2 rounded-full bg-primary ring-4 ring-card" />
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <div className="text-sm leading-snug">{e.message}</div>
                        <div className="text-xs text-muted-fg mt-1">
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

type AccentTone = "blue" | "violet" | "amber" | "red" | "green";

const ACCENT_STYLES: Record<AccentTone, { icon: string; value: string }> = {
  blue:   { icon: "bg-primary/10 text-primary",        value: "text-fg" },
  violet: { icon: "bg-[hsl(262_80%_55%/0.12)] text-[hsl(262_70%_50%)]", value: "text-fg" },
  amber:  { icon: "bg-accent/15 text-accent",          value: "text-fg" },
  red:    { icon: "bg-danger/10 text-danger",          value: "text-danger" },
  green:  { icon: "bg-success/10 text-success",        value: "text-fg" },
};

function KpiCard({
  label, value, icon, accent, href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: AccentTone;
  href: string;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-fg uppercase tracking-wider">{label}</div>
          <div className={`text-3xl font-semibold mt-2 tabular-nums tracking-tight ${styles.value}`}>
            {value}
          </div>
        </div>
        <div className={`size-10 rounded-lg grid place-items-center transition-transform group-hover:scale-105 ${styles.icon}`}>
          {icon}
        </div>
      </div>
    </Link>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 14) return "Mahlzeit";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

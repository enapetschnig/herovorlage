import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, DataTable, EmptyState, PageHeader } from "@heatflow/ui";
import { CalendarClock, CheckCircle2, Clock, Package, Wrench } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const trpc = await getTrpcCaller();
  const [kpi, contracts, upcoming] = await Promise.all([
    trpc.maintenance.dashboard(),
    trpc.maintenance.contractsList({ page: 1, pageSize: 100 }),
    trpc.maintenance.upcomingVisits({ days: 60 }),
  ]);

  return (
    <>
      <PageHeader
        title="Wartung & Anlagen"
        description="Modul M3 — Wartungsverträge, Anlagenstamm, automatische Wartungstermine."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPIs */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi label="Verträge" value={kpi.contracts} icon={<Wrench className="size-4" />} />
          <Kpi label="Überfällig" value={kpi.overdue} icon={<CalendarClock className="size-4" />} tone={kpi.overdue > 0 ? "danger" : "neutral"} />
          <Kpi label="Nächste 30 Tage" value={kpi.next30Days} icon={<Clock className="size-4" />} tone="warning" />
          <Kpi label="Tage 30–60" value={kpi.next60Days} icon={<Clock className="size-4" />} />
          <Kpi label="Anlagen gesamt" value={kpi.totalAssets} icon={<Package className="size-4" />} />
        </div>

        {/* Upcoming visits */}
        <Card>
          <CardHeader>
            <CardTitle>Anstehende Wartungstermine (60 Tage)</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title="Keine Wartungen in den nächsten 60 Tagen" />
            ) : (
              <ul className="divide-y divide-border -mx-2">
                {upcoming.map((v) => {
                  const daysUntil = Math.floor((new Date(v.scheduledAt).getTime() - Date.now()) / 86400000);
                  const overdue = daysUntil < 0;
                  return (
                    <li key={v.id} className="flex items-center gap-3 px-2 py-3">
                      <div className={`size-2 rounded-full ${overdue ? "bg-danger" : daysUntil < 7 ? "bg-warning" : "bg-success"}`} />
                      <div className="flex-1 min-w-0">
                        <Link href={`/maintenance/${v.contractId}`} className="text-sm font-medium hover:underline">
                          {v.contractName}
                        </Link>
                        <div className="text-xs text-muted-fg truncate">
                          <Link href={`/contacts/${v.contactId}`} className="hover:underline">{v.contactName}</Link>
                          {v.technicianName && ` · ${v.technicianName}`}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm tabular-nums">{formatDate(v.scheduledAt)}</div>
                        <div className={`text-xs ${overdue ? "text-danger" : "text-muted-fg"}`}>
                          {overdue ? `${Math.abs(daysUntil)} Tage überfällig` : `in ${daysUntil} Tagen`}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Contracts */}
        <Card>
          <CardHeader>
            <CardTitle>Wartungsverträge ({contracts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={contracts}
              rowKey={(c) => c.id}
              empty={<EmptyState icon={<Wrench className="size-5" />} title="Noch keine Verträge" description="Lege Wartungsverträge pro Kunde an, um Intervalle automatisch zu planen." />}
              columns={[
                { id: "name", header: "Vertrag", cell: (c) => (
                  <Link href={`/maintenance/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                )},
                { id: "contact", header: "Kunde", cell: (c) => (
                  <Link href={`/contacts/${c.contactId}`} className="text-sm hover:underline">{c.contactName}</Link>
                )},
                { id: "asset", header: "Anlage", cell: (c) => c.assetLabel ?? <span className="text-muted-fg">—</span> },
                { id: "interval", header: "Intervall", width: "100px", cell: (c) => `${c.intervalMonths} Mo.` },
                { id: "next", header: "Nächste Wartung", width: "150px", cell: (c) => c.nextDueDate ? formatDate(c.nextDueDate) : <span className="text-muted-fg">—</span> },
                { id: "price", header: "Preis", align: "right", width: "100px", cell: (c) => <span className="tabular-nums">{formatMoney(Number(c.price))}</span> },
                { id: "renewal", header: "Auto", width: "80px", cell: (c) => c.autoRenewal ? <Badge tone="success">Ja</Badge> : <Badge>Nein</Badge> },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone?: "danger" | "warning" | "neutral" }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex items-center justify-between">
      <div>
        <div className="text-xs text-muted-fg">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${toneClass}`}>{value}</div>
      </div>
      <div className={`size-8 rounded bg-muted grid place-items-center ${toneClass}`}>{icon}</div>
    </div>
  );
}

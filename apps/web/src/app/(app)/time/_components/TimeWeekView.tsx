"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent } from "@heatflow/ui";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type Member = { id: string; name: string; role: string };

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const TARGET_MIN_PER_DAY = 480; // 8h Soll

export function TimeWeekView({
  weekStart, userId, currentUserId, isApprover, members, initialData,
}: {
  weekStart: string;
  userId: string;
  currentUserId: string;
  isApprover: boolean;
  members: Member[];
  initialData: {
    days: Array<{
      date: string;
      workMinutes: number;
      pauseMinutes: number;
      pendingApproval: number;
      entries: Array<{
        startedAt: Date;
        endedAt: Date | null;
        duration: number;
        activityType: string;
        billable: boolean;
        approvedAt: Date | null;
        projectTitle: string | null;
        projectNumber: string | null;
      }>;
    }>;
    totals: { workMinutes: number; pauseMinutes: number; pendingApproval: number };
  };
}) {
  const router = useRouter();
  const q = trpc.time.byWeek.useQuery(
    { userId, fromDate: weekStart, toDate: addDaysIso(weekStart, 6) },
    { initialData, refetchOnMount: false },
  );
  const data = q.data ?? initialData;

  const approveAll = trpc.time.approveRange.useMutation({
    onSuccess: ({ approved }) => { toast.success(`${approved} Einträge genehmigt`); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const goWeek = (delta: number) => {
    const next = addDaysIso(weekStart, delta * 7);
    const params = new URLSearchParams({ week: next });
    if (userId !== currentUserId) params.set("user", userId);
    router.push(`/time/week?${params.toString()}`);
  };

  const billableMinutes = useMemo(
    () => data.days.reduce((sum, d) => sum + d.entries.filter((e) => e.billable).reduce((s, e) => s + e.duration, 0), 0),
    [data.days],
  );
  const targetTotal = TARGET_MIN_PER_DAY * 5; // 5 Werktage
  const balance = data.totals.workMinutes - targetTotal;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => goWeek(-1)} aria-label="vorherige Woche">
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-medium tabular-nums">
          {formatDateShort(weekStart)} – {formatDateShort(addDaysIso(weekStart, 6))}
        </div>
        <Button variant="ghost" size="icon" onClick={() => goWeek(1)} aria-label="nächste Woche">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/time/week`)}>Diese Woche</Button>
        <Link href={`/time?date=${weekStart}${userId !== currentUserId ? `&user=${userId}` : ""}`} className="ml-2">
          <Button variant="ghost" size="sm">Tagesansicht</Button>
        </Link>

        {isApprover && members.length > 1 && (
          <select
            value={userId}
            onChange={(e) => router.push(`/time/week?week=${weekStart}&user=${e.target.value}`)}
            className="h-9 px-3 rounded-md border border-input bg-bg text-sm ml-auto"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
            ))}
          </select>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Wochenstunden" value={formatHm(data.totals.workMinutes)} sub={`Soll: ${formatHm(targetTotal)}`} />
        <Kpi label="Davon abrechenbar" value={formatHm(billableMinutes)} sub={`${data.totals.workMinutes > 0 ? Math.round(100 * billableMinutes / data.totals.workMinutes) : 0}%`} />
        <Kpi label="Saldo" value={formatHmDelta(balance)} accent={balance >= 0 ? "success" : "warning"} />
        <Kpi label="Offen für Approval" value={String(data.totals.pendingApproval)} accent={data.totals.pendingApproval > 0 ? "warning" : "success"} />
      </div>

      {/* Week grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-fg">
              <tr>
                {data.days.map((d, i) => {
                  const date = new Date(d.date + "T00:00:00Z");
                  const isToday = d.date === new Date().toISOString().slice(0, 10);
                  return (
                    <th key={d.date} className={`p-3 text-left border-l border-border first:border-l-0 ${isToday ? "bg-primary/5" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span>{DAY_NAMES[i]} {date.getUTCDate()}.{(date.getUTCMonth() + 1).toString().padStart(2, "0")}</span>
                        {isToday && <Badge tone="primary">heute</Badge>}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {data.days.map((d) => (
                  <td key={d.date} className="border-l border-t border-border first:border-l-0 align-top p-2 min-w-[140px]">
                    {d.entries.length === 0 ? (
                      <div className="text-xs text-muted-fg py-2 text-center">—</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {d.entries.map((e, j) => (
                          <li key={j} className={`px-2 py-1.5 rounded text-xs ${e.activityType === "break" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
                            <div className="flex items-center justify-between font-medium">
                              <span>{formatHm(e.duration)}</span>
                              {e.approvedAt ? <CheckCircle2 className="size-3" /> : null}
                            </div>
                            {e.projectNumber && (
                              <div className="text-muted-fg truncate" title={e.projectTitle ?? ""}>
                                {e.projectNumber}
                              </div>
                            )}
                            {!e.projectNumber && (
                              <div className="text-muted-fg uppercase text-[10px]">{e.activityType}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/30 border-t-2 border-border">
                {data.days.map((d) => (
                  <td key={d.date} className="border-l border-border first:border-l-0 p-2">
                    <div className="text-base font-semibold tabular-nums">{formatHm(d.workMinutes)}</div>
                    {d.pauseMinutes > 0 && <div className="text-xs text-muted-fg">+ {formatHm(d.pauseMinutes)} Pause</div>}
                    {d.pendingApproval > 0 && <div className="text-xs text-warning">{d.pendingApproval} offen</div>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Approve action */}
      {isApprover && data.totals.pendingApproval > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="text-sm">
              <strong>{data.totals.pendingApproval}</strong> Zeiteinträge in dieser Woche warten auf Genehmigung
              {userId !== currentUserId && ` für ${members.find((m) => m.id === userId)?.name}`}.
            </div>
            <Button
              disabled={approveAll.isPending}
              onClick={() => {
                if (!window.confirm(`${data.totals.pendingApproval} Zeiteinträge genehmigen?`)) return;
                approveAll.mutate({ userId, fromDate: weekStart, toDate: addDaysIso(weekStart, 6) });
              }}
            >
              {approveAll.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Alle genehmigen
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "success" | "warning" }) {
  const toneClass = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted-fg mt-0.5">{sub}</div>}
    </div>
  );
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate().toString().padStart(2, "0")}.${(d.getUTCMonth() + 1).toString().padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function formatHm(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatHmDelta(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "−";
  return `${sign}${formatHm(minutes)}`;
}

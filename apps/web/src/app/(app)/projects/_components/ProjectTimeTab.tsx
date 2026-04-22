"use client";
import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { Avatar, EmptyState } from "@heatflow/ui";
import { Clock, Loader2 } from "lucide-react";

export function ProjectTimeTab({ projectId }: { projectId: string }) {
  const q = trpc.time.byProject.useQuery({ projectId });

  if (q.isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-fg"><Loader2 className="size-5 animate-spin" /></div>;
  }

  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        title="Keine Zeiteinträge"
        description="Sobald Mitarbeiter Stunden auf dieses Projekt buchen, erscheinen sie hier."
        icon={<Clock className="size-5" />}
      />
    );
  }

  const totalMinutes = q.data.reduce((sum, r) => sum + Number(r.totalMinutes), 0);
  const billableMinutes = q.data.reduce((sum, r) => sum + Number(r.billableMinutes), 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Kpi label="Gesamt" value={formatHm(totalMinutes)} />
        <Kpi label="Davon abrechenbar" value={formatHm(billableMinutes)} />
        <Kpi label="Mitarbeiter" value={String(q.data.length)} />
      </div>

      <ul className="border border-border rounded-lg divide-y divide-border bg-card">
        {q.data
          .sort((a, b) => Number(b.totalMinutes) - Number(a.totalMinutes))
          .map((r) => (
            <li key={r.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={r.userName ?? ""} />
              <div className="flex-1 min-w-0">
                <Link href={`/time?user=${r.userId}`} className="text-sm font-medium hover:underline">
                  {r.userName}
                </Link>
                <div className="text-xs text-muted-fg">{r.entries} Einträge</div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums">{formatHm(Number(r.totalMinutes))}</div>
                <div className="text-xs text-muted-fg">{formatHm(Number(r.billableMinutes))} abr.</div>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function formatHm(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

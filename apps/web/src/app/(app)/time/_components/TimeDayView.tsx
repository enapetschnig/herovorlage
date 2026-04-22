"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { toast } from "sonner";
import { Briefcase, CalendarDays, ChevronLeft, ChevronRight, Coffee, Loader2, Pause, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";

type Member = { id: string; name: string; role: string };
type Category = { id: string; name: string; color: string | null; billable: boolean };
type ProjectOpt = { id: string; label: string };

type Entry = {
  id: string;
  projectId: string | null;
  activityType: string;
  categoryId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  breakMinutes: number;
  durationMinutes: number | null;
  billable: boolean;
  comment: string | null;
  approvedAt: Date | null;
  projectTitle: string | null;
  projectNumber: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export function TimeDayView({
  date, userId, currentUserId, isAdmin, members, categories, projects,
}: {
  date: string;
  userId: string;
  currentUserId: string;
  isAdmin: boolean;
  members: Member[];
  categories: Category[];
  projects: ProjectOpt[];
}) {
  const router = useRouter();

  const dayQuery = trpc.time.byDay.useQuery({ userId, date }, { staleTime: 5_000 });
  const running = trpc.time.running.useQuery(undefined, {
    enabled: userId === currentUserId,
    refetchInterval: 30_000,
  });

  const utils = trpc.useUtils();
  const refresh = () => {
    dayQuery.refetch();
    running.refetch();
  };

  const create = trpc.time.create.useMutation({ onSuccess: () => { toast.success("Eintrag gespeichert"); refresh(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.time.update.useMutation({ onSuccess: () => { refresh(); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.time.remove.useMutation({ onSuccess: () => { toast.success("Gelöscht"); refresh(); }, onError: (e) => toast.error(e.message) });
  const quickStart = trpc.time.quickStart.useMutation({ onSuccess: () => { toast.success("Timer gestartet"); refresh(); }, onError: (e) => toast.error(e.message) });
  const quickStop = trpc.time.quickStop.useMutation({ onSuccess: ({ durationMinutes }) => { toast.success(`Timer gestoppt — ${formatHm(durationMinutes ?? 0)}`); refresh(); }, onError: (e) => toast.error(e.message) });

  const entries = (dayQuery.data?.items ?? []) as unknown as Entry[];
  const summary = dayQuery.data?.summary ?? { workMinutes: 0, pauseMinutes: 0, billableMinutes: 0 };

  const workEntries = useMemo(() => entries.filter((e) => e.activityType !== "break"), [entries]);
  const breakEntries = useMemo(() => entries.filter((e) => e.activityType === "break"), [entries]);

  // Date navigation
  const goDay = (delta: number) => {
    const d = new Date(date + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    const next = d.toISOString().slice(0, 10);
    const params = new URLSearchParams();
    params.set("date", next);
    if (userId !== currentUserId) params.set("user", userId);
    router.push(`/time?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => goDay(-1)} aria-label="vorheriger Tag">
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="date"
          value={date}
          onChange={(e) => router.push(`/time?date=${e.target.value}${userId !== currentUserId ? `&user=${userId}` : ""}`)}
          className="h-9 px-3 rounded-md border border-input bg-bg text-sm"
        />
        <Button variant="ghost" size="icon" onClick={() => goDay(1)} aria-label="nächster Tag">
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/time?date=${new Date().toISOString().slice(0, 10)}`)}>Heute</Button>
        <Link href={`/time/week${userId !== currentUserId ? `?user=${userId}` : ""}`}>
          <Button variant="ghost" size="sm"><CalendarDays className="size-4" /> Wochenansicht</Button>
        </Link>

        {isAdmin && members.length > 1 && (
          <select
            value={userId}
            onChange={(e) => router.push(`/time?date=${date}&user=${e.target.value}`)}
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
        <Kpi label="Arbeitszeit" value={formatHm(summary.workMinutes)} />
        <Kpi label="Pausenzeit" value={formatHm(summary.pauseMinutes)} />
        <Kpi label="Davon abrechenbar" value={formatHm(summary.billableMinutes)} />
        <Kpi label="Saldo (8h Soll)" value={formatHmDelta(summary.workMinutes - 480)} accent={summary.workMinutes >= 480 ? "success" : "warning"} />
      </div>

      {/* Quick timer */}
      {userId === currentUserId && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            {running.data ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-3 rounded-full bg-success animate-pulse" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      Läuft: {running.data.projectTitle ?? "(ohne Projekt)"} · {running.data.activityType}
                    </div>
                    <div className="text-xs text-muted-fg">
                      Seit {formatTime(running.data.startedAt as unknown as Date)} ·{" "}
                      {formatHm(Math.floor((Date.now() - new Date(running.data.startedAt).getTime()) / 60000))}
                    </div>
                  </div>
                </div>
                <Button variant="danger" size="sm" disabled={quickStop.isPending} onClick={() => quickStop.mutate()}>
                  {quickStop.isPending ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />} Stop
                </Button>
              </>
            ) : (
              <QuickStarter projects={projects} onStart={(input) => quickStart.mutate(input)} pending={quickStart.isPending} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Two big cards: Arbeitszeit + Pausenzeit */}
      <div className="grid lg:grid-cols-2 gap-4">
        <EntryGroup
          title="Arbeitszeit"
          icon={<Briefcase className="size-5" />}
          totalMinutes={summary.workMinutes}
          entries={workEntries}
          categories={categories}
          projects={projects}
          onAdd={() =>
            create.mutate({
              userId,
              startedAt: new Date(date + "T08:00:00.000Z").toISOString(),
              endedAt: new Date(date + "T16:00:00.000Z").toISOString(),
              activityType: "work",
              breakMinutes: 30,
              billable: true,
            })
          }
          onUpdate={(id, patch) => update.mutate({ id, ...patch })}
          onRemove={(id) => remove.mutate({ id })}
        />
        <EntryGroup
          title="Pausenzeit"
          icon={<Coffee className="size-5" />}
          totalMinutes={summary.pauseMinutes}
          entries={breakEntries}
          categories={categories}
          projects={projects}
          onAdd={() =>
            create.mutate({
              userId,
              startedAt: new Date(date + "T12:00:00.000Z").toISOString(),
              endedAt: new Date(date + "T12:30:00.000Z").toISOString(),
              activityType: "break",
              breakMinutes: 0,
              billable: false,
            })
          }
          onUpdate={(id, patch) => update.mutate({ id, ...patch })}
          onRemove={(id) => remove.mutate({ id })}
          variant="break"
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "success" | "warning" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function EntryGroup({
  title, icon, totalMinutes, entries, categories, projects, onAdd, onUpdate, onRemove, variant = "work",
}: {
  title: string;
  icon: React.ReactNode;
  totalMinutes: number;
  entries: Entry[];
  categories: Category[];
  projects: ProjectOpt[];
  onAdd: () => void;
  onUpdate: (id: string, patch: { startedAt?: string; endedAt?: string | null; breakMinutes?: number; categoryId?: string | null; projectId?: string | null; comment?: string; activityType?: "work" | "break" | "drive" | "office" | "consulting" | "maintenance" }) => void;
  onRemove: (id: string) => void;
  variant?: "work" | "break";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">{icon}{title}</span>
          <span className="text-2xl tabular-nums">{formatHm(totalMinutes)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-fg text-center py-6">
            {variant === "break" ? "Keine Pausen erfasst." : "Keine Arbeitszeiten erfasst."}
          </p>
        ) : (
          entries.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              categories={categories}
              projects={projects}
              variant={variant}
              onUpdate={(patch) => onUpdate(e.id, patch)}
              onRemove={() => onRemove(e.id)}
            />
          ))
        )}
        <Button variant="ghost" size="sm" onClick={onAdd} className="w-full">
          <Plus className="size-4" /> {variant === "break" ? "+ Pause" : "+ Eintrag"}
        </Button>
      </CardContent>
    </Card>
  );
}

function EntryRow({
  entry, categories, projects, variant, onUpdate, onRemove,
}: {
  entry: Entry;
  categories: Category[];
  projects: ProjectOpt[];
  variant: "work" | "break";
  onUpdate: (patch: { startedAt?: string; endedAt?: string | null; categoryId?: string | null; projectId?: string | null; comment?: string }) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(entry.comment ?? "");

  const dur = entry.durationMinutes ?? (entry.endedAt ? Math.floor((new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) / 60000) : null);

  if (!editing) {
    return (
      <div className="flex items-center gap-3 p-3 border border-border rounded">
        {variant === "break" ? <Coffee className="size-4 text-muted-fg" /> : (
          <span
            className="size-3 rounded-full"
            style={{ backgroundColor: entry.categoryColor ?? "#6366f1" }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="tabular-nums font-medium">{formatTime(entry.startedAt)} – {entry.endedAt ? formatTime(entry.endedAt) : <em>läuft</em>}</span>
            <span className="text-muted-fg">·</span>
            <span className="tabular-nums">{dur !== null ? formatHm(dur) : "—"}</span>
            {entry.categoryName && <Badge>{entry.categoryName}</Badge>}
            {entry.approvedAt && <Badge tone="success">✓</Badge>}
          </div>
          {entry.projectId && (
            <Link href={`/projects/${entry.projectId}`} className="text-xs text-muted-fg hover:underline truncate block">
              {entry.projectNumber} — {entry.projectTitle}
            </Link>
          )}
          {entry.comment && <div className="text-xs text-muted-fg mt-0.5 line-clamp-1">{entry.comment}</div>}
        </div>
        <button onClick={() => setEditing(true)} className="p-1.5 rounded hover:bg-muted text-muted-fg" aria-label="Bearbeiten"><Pencil className="size-3.5" /></button>
        <button onClick={onRemove} className="p-1.5 rounded hover:bg-danger/10 text-danger" aria-label="Löschen"><Trash2 className="size-3.5" /></button>
      </div>
    );
  }

  // Inline edit
  const localDate = entry.startedAt instanceof Date ? entry.startedAt : new Date(entry.startedAt);
  const day = localDate.toISOString().slice(0, 10);
  const startHm = formatTime(entry.startedAt);
  const endHm = entry.endedAt ? formatTime(entry.endedAt) : startHm;

  return (
    <div className="p-3 border border-primary/30 bg-primary/5 rounded space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="time" defaultValue={startHm}
          onBlur={(e) => onUpdate({ startedAt: new Date(`${day}T${e.target.value}:00.000Z`).toISOString() })}
          className="h-8 px-2 rounded border border-input bg-bg text-sm"
        />
        <input
          type="time" defaultValue={endHm}
          onBlur={(e) => onUpdate({ endedAt: new Date(`${day}T${e.target.value}:00.000Z`).toISOString() })}
          className="h-8 px-2 rounded border border-input bg-bg text-sm"
        />
      </div>
      {variant !== "break" && (
        <>
          <select
            defaultValue={entry.categoryId ?? ""}
            onChange={(e) => onUpdate({ categoryId: e.target.value || null })}
            className="h-8 px-2 rounded border border-input bg-bg text-sm w-full"
          >
            <option value="">— Kategorie —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            defaultValue={entry.projectId ?? ""}
            onChange={(e) => onUpdate({ projectId: e.target.value || null })}
            className="h-8 px-2 rounded border border-input bg-bg text-sm w-full"
          >
            <option value="">— ohne Projekt —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </>
      )}
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={() => comment !== (entry.comment ?? "") && onUpdate({ comment })}
        placeholder="Kommentar"
        className="w-full px-2 py-1 rounded border border-input bg-bg text-sm"
      />
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Fertig</Button>
      </div>
    </div>
  );
}

function QuickStarter({ projects, onStart, pending }: { projects: ProjectOpt[]; onStart: (input: { projectId: string | null; activityType: "work" | "break" | "drive" | "office" }) => void; pending: boolean }) {
  const [projectId, setProjectId] = useState<string>("");
  const [activity, setActivity] = useState<"work" | "drive" | "office">("work");
  return (
    <div className="flex items-center gap-2 flex-wrap w-full">
      <Pause className="size-4 text-muted-fg" />
      <span className="text-sm text-muted-fg">Kein Timer aktiv —</span>
      <select
        value={activity}
        onChange={(e) => setActivity(e.target.value as "work" | "drive" | "office")}
        className="h-9 px-2 rounded border border-input bg-bg text-sm"
      >
        <option value="work">Arbeit</option>
        <option value="drive">Fahrt</option>
        <option value="office">Büro</option>
      </select>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="h-9 px-2 rounded border border-input bg-bg text-sm flex-1 min-w-0"
      >
        <option value="">— ohne Projekt —</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      <Button size="sm" disabled={pending} onClick={() => onStart({ projectId: projectId || null, activityType: activity })}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Start
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit", hour12: false });
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

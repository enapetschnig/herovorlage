"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Input } from "@heatflow/ui";
import { formatDate, formatMoney } from "@heatflow/utils";
import { toast } from "sonner";
import { CheckCircle2, FileSpreadsheet, Loader2, Plus, Trash2, X } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  submitted: "Eingereicht",
  approved: "Bewilligt",
  rejected: "Abgelehnt",
  paid: "Ausbezahlt",
};
const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "danger" | "warning"> = {
  draft: "neutral", submitted: "primary", approved: "success", rejected: "danger", paid: "success",
};

export function ProjectFundingTab({ projectId }: { projectId: string }) {
  const q = trpc.funding.byProject.useQuery({ projectId });
  const programs = trpc.funding.programs.useQuery();
  const [open, setOpen] = useState(false);

  const create = trpc.funding.createApplication.useMutation({
    onSuccess: () => { toast.success("Förderantrag angelegt"); q.refetch(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.funding.updateStatus.useMutation({
    onSuccess: () => { toast.success("Status aktualisiert"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.funding.remove.useMutation({
    onSuccess: () => { toast.success("Antrag entfernt"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  if (q.isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-fg"><Loader2 className="size-5 animate-spin" /></div>;
  }

  const apps = q.data ?? [];
  const totalRequested = apps.reduce((s, a) => s + Number(a.amountRequested ?? 0), 0);
  const totalApproved = apps.reduce((s, a) => s + Number(a.amountApproved ?? 0), 0);

  return (
    <div className="space-y-4">
      {apps.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Kpi label="Anträge" value={String(apps.length)} />
          <Kpi label="Beantragt" value={formatMoney(totalRequested)} />
          <Kpi label="Bewilligt" value={formatMoney(totalApproved)} tone={totalApproved > 0 ? "success" : "neutral"} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Förderanträge</span>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Neuer Antrag</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="size-5" />}
              title="Keine Förderanträge"
              description="BAFA, KfW, Raus-aus-Öl-Bonus … hier verwalten mit Status-Tracking und Fristen-Erinnerungen."
            />
          ) : (
            <ul className="divide-y divide-border">
              {apps.map((a) => (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{a.programName}</span>
                      <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      <span className="text-xs text-muted-fg">max. {formatMoney(Number(a.programMaxAmount ?? 0))}</span>
                    </div>
                    <div className="text-sm mt-1 flex items-center gap-4">
                      <span>Beantragt: <strong className="tabular-nums">{formatMoney(Number(a.amountRequested ?? 0))}</strong></span>
                      {a.amountApproved !== null && Number(a.amountApproved) > 0 && (
                        <span className="text-success">Bewilligt: <strong className="tabular-nums">{formatMoney(Number(a.amountApproved))}</strong></span>
                      )}
                    </div>
                    <div className="text-xs text-muted-fg mt-1 space-x-3">
                      {a.submittedAt && <span>Eingereicht {formatDate(a.submittedAt)}</span>}
                      {a.approvedAt && <span>· Bewilligt {formatDate(a.approvedAt)}</span>}
                      {a.paidAt && <span>· Ausbezahlt {formatDate(a.paidAt)}</span>}
                    </div>
                    {a.notes && <p className="text-xs text-muted-fg mt-1 italic">{a.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <select
                      value={a.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as "draft" | "submitted" | "approved" | "rejected" | "paid";
                        if (newStatus === "approved") {
                          const amt = prompt("Bewilligter Betrag (€)?", String(a.amountRequested ?? 0));
                          if (amt === null) return;
                          update.mutate({ id: a.id, status: newStatus, amountApproved: Number(amt) || 0 });
                        } else {
                          update.mutate({ id: a.id, status: newStatus });
                        }
                      }}
                      className="h-7 px-2 text-xs rounded border border-input bg-bg"
                    >
                      {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button
                      onClick={() => { if (window.confirm("Antrag löschen?")) remove.mutate({ id: a.id }); }}
                      className="p-1 rounded hover:bg-danger/10 text-danger self-end"
                      aria-label="Entfernen"
                    ><Trash2 className="size-3" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {open && (
        <NewApplicationDialog
          programs={programs.data ?? []}
          onClose={() => setOpen(false)}
          onSubmit={(p) => create.mutate({ projectId, ...p })}
          pending={create.isPending}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "neutral" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tone === "success" ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}

function NewApplicationDialog({
  programs, onClose, onSubmit, pending,
}: {
  programs: { id: string; name: string; country: string; maxAmount: string | null; description: string | null }[];
  onClose: () => void;
  onSubmit: (v: { programId: string; amountRequested: number; notes?: string }) => void;
  pending: boolean;
}) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");

  const selectedProgram = programs.find((p) => p.id === programId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Neuer Förderantrag</h2>
          <button onClick={onClose} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg"><X className="size-4" /></button>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ programId, amountRequested: amount, notes: notes || undefined }); }} className="p-5 space-y-3">
          <Field label="Förderprogramm" required>
            <select value={programId} onChange={(e) => { setProgramId(e.target.value); const p = programs.find((x) => x.id === e.target.value); if (p?.maxAmount) setAmount(Number(p.maxAmount)); }} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.country})</option>
              ))}
            </select>
          </Field>
          {selectedProgram?.description && (
            <div className="text-xs text-muted-fg p-2 rounded bg-muted/50">
              {selectedProgram.description}
              {selectedProgram.maxAmount && <><br />Max. Förderbetrag: <strong>{formatMoney(Number(selectedProgram.maxAmount))}</strong></>}
            </div>
          )}
          <Field label="Beantragter Betrag (€)" required>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          </Field>
          <Field label="Notizen (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z.B. Antragsnr., Frist, Unterlagen-Status" />
          </Field>

          <footer className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={pending || !programId || amount <= 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Anlegen
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

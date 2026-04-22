"use client";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type ChecklistItem = { id: string; label: string; required?: boolean; group?: string; helpText?: string };

export function ChecklistCard({
  entityType, entityId,
}: {
  entityType: "project" | "maintenance_visit" | "contact" | "document";
  entityId: string;
}) {
  const instances = trpc.checklists.instancesByEntity.useQuery({ entityType, entityId });
  const templates = trpc.checklists.templates.useQuery({ entityType });
  const [adding, setAdding] = useState(false);

  const apply = trpc.checklists.applyTemplate.useMutation({
    onSuccess: () => { toast.success("Checkliste hinzugefügt"); instances.refetch(); setAdding(false); },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.checklists.updateInstanceState.useMutation({
    onSuccess: () => instances.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const complete = trpc.checklists.completeInstance.useMutation({
    onSuccess: () => { toast.success("Checkliste abgeschlossen"); instances.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.checklists.removeInstance.useMutation({
    onSuccess: () => instances.refetch(),
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Checklisten</span>
          {!adding ? (
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Checkliste hinzufügen
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              <X className="size-4" /> Abbrechen
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="border border-border rounded p-3 bg-muted/30 space-y-2">
            <div className="text-xs text-muted-fg">Vorlage wählen:</div>
            {(templates.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-fg">Keine Vorlagen für diesen Entity-Typ. Lege welche unter <code>/checklists</code> an.</div>
            ) : (
              <ul className="space-y-1.5">
                {templates.data!.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={apply.isPending}
                      onClick={() => apply.mutate({ templateId: t.id, entityType, entityId })}
                      className="w-full text-left px-3 py-2 rounded border border-border bg-bg hover:bg-muted/30 text-sm"
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-fg">{(t.items as ChecklistItem[] ?? []).length} Punkte</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {instances.isLoading ? (
          <div className="text-sm text-muted-fg py-2"><Loader2 className="size-4 animate-spin inline mr-2" /> lade…</div>
        ) : (instances.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-fg py-2">Keine aktiven Checklisten.</p>
        ) : (
          (instances.data!).map((inst) => (
            <ChecklistInstance
              key={inst.id}
              instance={inst as never}
              onChange={(state) => update.mutate({ id: inst.id, itemsState: state })}
              onComplete={() => complete.mutate({ id: inst.id })}
              onRemove={() => { if (window.confirm("Checkliste entfernen?")) remove.mutate({ id: inst.id }); }}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

type Instance = {
  id: string;
  templateName: string | null;
  itemsState: Record<string, boolean>;
  items: ChecklistItem[];
  completedAt: Date | null;
};

function ChecklistInstance({
  instance, onChange, onComplete, onRemove,
}: {
  instance: Instance;
  onChange: (s: Record<string, boolean>) => void;
  onComplete: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const items = instance.items ?? [];
  const state = instance.itemsState ?? {};
  const checked = items.filter((i) => state[i.id]).length;
  const requiredOpen = items.filter((i) => i.required && !state[i.id]).length;
  const allRequired = requiredOpen === 0;
  const isCompleted = !!instance.completedAt;

  // Group items
  const groups = useMemo(() => {
    const out = new Map<string, ChecklistItem[]>();
    for (const it of items) {
      const g = it.group ?? "";
      const list = out.get(g) ?? [];
      list.push(it);
      out.set(g, list);
    }
    return Array.from(out.entries());
  }, [items]);

  return (
    <div className={`border rounded ${isCompleted ? "border-success/30 bg-success/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between p-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-medium text-sm">{instance.templateName}</span>
          <Badge tone={isCompleted ? "success" : allRequired ? "primary" : "neutral"}>
            {checked} / {items.length}
            {!isCompleted && requiredOpen > 0 && ` · ${requiredOpen} Pflicht offen`}
          </Badge>
          {isCompleted && <Badge tone="success">✓ abgeschlossen</Badge>}
        </button>
        <div className="flex gap-1">
          {!isCompleted && allRequired && (
            <Button size="sm" onClick={onComplete}>
              <CheckCircle2 className="size-3.5" /> Fertig
            </Button>
          )}
          <button onClick={onRemove} className="p-1.5 rounded hover:bg-danger/10 text-danger" aria-label="Entfernen">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border p-3 space-y-3">
          {groups.map(([g, list]) => (
            <div key={g}>
              {g && <div className="text-xs uppercase tracking-wider text-muted-fg mb-1.5">{g}</div>}
              <ul className="space-y-1">
                {list.map((it) => (
                  <li key={it.id}>
                    <label className={`flex items-start gap-2 text-sm cursor-pointer ${state[it.id] ? "text-muted-fg line-through" : ""}`}>
                      <input
                        type="checkbox"
                        checked={!!state[it.id]}
                        disabled={isCompleted}
                        onChange={(e) => onChange({ ...state, [it.id]: e.target.checked })}
                        className="mt-1"
                      />
                      <span className="flex-1">
                        {it.label}
                        {it.required && <span className="text-danger ml-1">*</span>}
                        {it.helpText && <div className="text-xs text-muted-fg">{it.helpText}</div>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

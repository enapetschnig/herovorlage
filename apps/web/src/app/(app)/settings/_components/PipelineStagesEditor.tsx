"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function PipelineStagesEditor({ initialStages }: { initialStages: string[] }) {
  const router = useRouter();
  const [stages, setStages] = useState<string[]>(initialStages);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);

  const save = trpc.tenant.updatePipelineStages.useMutation({
    onSuccess: () => {
      toast.success("Pipeline-Stufen gespeichert");
      setDirty(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  function addStage() {
    const v = draft.trim();
    if (!v) return;
    if (stages.includes(v)) {
      toast.error("Existiert bereits");
      return;
    }
    setStages([...stages, v]);
    setDraft("");
    setDirty(true);
  }

  function removeStage(idx: number) {
    setStages(stages.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function move(idx: number, delta: -1 | 1) {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const arr = [...stages];
    [arr[idx], arr[newIdx]] = [arr[newIdx]!, arr[idx]!];
    setStages(arr);
    setDirty(true);
  }

  function rename(idx: number, value: string) {
    const arr = [...stages];
    arr[idx] = value;
    setStages(arr);
    setDirty(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Projekt-Pipeline</CardTitle>
            <p className="text-xs text-muted-fg mt-1">
              Die Stufen, die Projekte durchlaufen (z.&nbsp;B. Erstgespräch → Angebot → Montage → Rechnung). Pro Projekt setzbar.
            </p>
          </div>
          <Button
            size="sm"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ stages })}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Speichern
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1.5">
          {stages.map((stage, idx) => (
            <li
              key={`${stage}_${idx}`}
              className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 hover:border-primary/30 transition-colors"
            >
              <div className="size-6 grid place-items-center rounded bg-muted text-muted-fg text-[11px] font-semibold tabular-nums flex-shrink-0">
                {idx + 1}
              </div>
              <input
                value={stage}
                onChange={(e) => rename(idx, e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm font-medium min-w-0"
              />
              <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Nach oben"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === stages.length - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Nach unten"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStage(idx)}
                  className="p-1 rounded hover:bg-danger/10 hover:text-danger"
                  aria-label="Entfernen"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addStage();
              }
            }}
            placeholder="Neue Stufe hinzufügen…"
            className="flex-1 h-9 px-3 rounded-md border border-border bg-card text-sm placeholder:text-muted-fg focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-1 focus:ring-offset-bg"
          />
          <Button variant="secondary" size="sm" onClick={addStage} disabled={!draft.trim()}>
            <Plus className="size-4" />
            Hinzufügen
          </Button>
        </div>

        {dirty && (
          <div className="text-xs text-muted-fg italic pt-1">Ungespeicherte Änderungen — klick „Speichern".</div>
        )}
      </CardContent>
    </Card>
  );
}

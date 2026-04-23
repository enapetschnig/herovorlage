"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PipelineStepper({
  projectId,
  stages,
  currentStage,
}: {
  projectId: string;
  stages: string[];
  currentStage: string | null;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<string | null>(currentStage);
  const mutation = trpc.projects.setPipelineStage.useMutation({
    onSuccess: () => {
      router.refresh();
    },
    onError: (e) => {
      toast.error(e.message);
      setOptimistic(currentStage);
    },
  });

  const activeIdx = optimistic ? stages.indexOf(optimistic) : -1;

  function setStage(stage: string) {
    if (stage === optimistic) return;
    setOptimistic(stage);
    mutation.mutate({ id: projectId, stage });
    toast.success(`Auf „${stage}" gesetzt`);
  }

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-fg">
        Keine Pipeline-Stufen definiert. Unter <strong>Einstellungen → Projekt-Pipeline</strong> kannst du welche anlegen.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Pipeline-Stufe</h3>
        {mutation.isPending && <Loader2 className="size-3.5 animate-spin text-muted-fg" />}
      </div>

      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-border" aria-hidden="true" />
        {activeIdx >= 0 && (
          <div
            className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-300"
            style={{ width: `calc(${(activeIdx / Math.max(1, stages.length - 1)) * 100}% - 0.5rem)` }}
            aria-hidden="true"
          />
        )}

        {/* Stage dots + labels */}
        <div className="relative grid gap-1" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
          {stages.map((stage, idx) => {
            const isDone = activeIdx >= 0 && idx < activeIdx;
            const isActive = idx === activeIdx;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setStage(stage)}
                disabled={mutation.isPending}
                className="group flex flex-col items-center gap-2 min-w-0 hover:bg-muted/40 rounded-md px-1 py-1 -mx-1 transition-colors disabled:opacity-60"
              >
                <span
                  className={`relative z-10 size-8 rounded-full grid place-items-center text-xs font-semibold ring-2 ring-card transition-all ${
                    isActive
                      ? "bg-primary text-primary-fg ring-primary/30 shadow-md shadow-primary/20"
                      : isDone
                      ? "bg-success text-success-fg"
                      : "bg-card text-muted-fg border border-border group-hover:border-primary/50"
                  }`}
                >
                  {isDone ? <Check className="size-4" strokeWidth={3} /> : <span>{idx + 1}</span>}
                </span>
                <span
                  className={`text-[11px] leading-tight text-center truncate w-full px-0.5 ${
                    isActive ? "font-semibold text-fg" : isDone ? "text-fg" : "text-muted-fg group-hover:text-fg"
                  }`}
                  title={stage}
                >
                  {stage}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {optimistic && activeIdx < stages.length - 1 && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-fg">Nächste Stufe:</span>
          <button
            type="button"
            onClick={() => setStage(stages[activeIdx + 1]!)}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {stages[activeIdx + 1]} <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

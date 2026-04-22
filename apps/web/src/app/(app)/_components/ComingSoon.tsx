import { EmptyState, PageHeader } from "@heatflow/ui";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, phase, description }: { title: string; phase: string; description?: string }) {
  return (
    <>
      <PageHeader title={title} description={`Geplant für ${phase}.`} />
      <div className="p-6">
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title="Bald verfügbar"
          description={description ?? `Dieser Bereich wird in ${phase} der Roadmap implementiert. Siehe CLAUDE.md Teil N.`}
        />
      </div>
    </>
  );
}

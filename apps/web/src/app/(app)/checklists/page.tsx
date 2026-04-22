import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader } from "@heatflow/ui";
import { CheckSquare } from "lucide-react";

export const dynamic = "force-dynamic";

const ENTITY_LABEL: Record<string, string> = {
  project: "Projekt",
  maintenance_visit: "Wartungstermin",
  contact: "Kontakt",
  document: "Dokument",
};

export default async function ChecklistsPage() {
  const trpc = await getTrpcCaller();
  const templates = await trpc.checklists.templates({});

  return (
    <>
      <PageHeader
        title="Checklisten-Vorlagen"
        description="Modul M13 — wiederverwendbare Checklisten für Projekte, Wartungstermine, Kontakte"
      />
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {templates.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<CheckSquare className="size-5" />}
                title="Keine Vorlagen"
                description="Lege Vorlagen über die API an oder seede über scripts/seed_checklists.py."
              />
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => {
            const items = (t.items as Array<{ id: string; label: string; required?: boolean; group?: string }>) ?? [];
            const required = items.filter((i) => i.required).length;
            const groups = Array.from(new Set(items.map((i) => i.group).filter(Boolean)));
            return (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{t.name}</span>
                    <div className="flex gap-2">
                      <Badge>{ENTITY_LABEL[t.entityType] ?? t.entityType}</Badge>
                      <Badge tone="primary">{items.length} Punkte</Badge>
                      {required > 0 && <Badge tone="danger">{required} Pflicht</Badge>}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {groups.map((g) => (
                        <span key={g} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-fg">{g}</span>
                      ))}
                    </div>
                  )}
                  <ul className="text-sm space-y-1">
                    {items.slice(0, 6).map((i) => (
                      <li key={i.id} className="flex items-start gap-2 text-muted-fg">
                        <span className="text-muted-fg">•</span>
                        <span>{i.label}{i.required && <span className="text-danger ml-1">*</span>}</span>
                      </li>
                    ))}
                    {items.length > 6 && <li className="text-xs text-muted-fg pl-3">… +{items.length - 6} weitere</li>}
                  </ul>
                </CardContent>
              </Card>
            );
          })
        )}
        <p className="text-xs text-muted-fg pt-2">
          Vorlagen werden im Projekt-Detail unter Tab „Checklisten" anwendbar — Foreman/Monteur kann sie dort instanziieren und abhaken.
        </p>
      </div>
    </>
  );
}

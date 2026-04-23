import { getTrpcCaller } from "@/server/trpc";
import { Avatar, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heatflow/ui";
import { CORE_FEATURES, FEATURES } from "@heatflow/utils/constants";
import { DatevExportCard } from "./_components/DatevExportCard";
import { PipelineStagesEditor } from "./_components/PipelineStagesEditor";

export const dynamic = "force-dynamic";

const FEATURE_LABELS: Record<string, string> = {
  [FEATURES.CORE_CONTACTS]: "Kontakte (Core)",
  [FEATURES.CORE_PROJECTS]: "Projekte (Core)",
  [FEATURES.CORE_DOCUMENTS]: "Dokumente (Core)",
  [FEATURES.CORE_ARTICLES]: "Artikel (Core)",
  [FEATURES.CORE_TIME]: "Zeiterfassung (Core)",
  [FEATURES.CORE_E_INVOICE]: "E-Rechnung (Core)",
  [FEATURES.CORE_MOBILE]: "Mobile-App (Core)",
  [FEATURES.CORE_PORTAL]: "Kundenportal (Core)",
  [FEATURES.M1_DATANORM]: "M1 Datanorm-Import",
  [FEATURES.M2_IDS_CONNECT]: "M2 IDS Connect",
  [FEATURES.M3_MAINTENANCE]: "M3 Wartungsverträge",
  [FEATURES.M4_PLANNING]: "M4 Plantafel",
  [FEATURES.M5_CALCULATION]: "M5 Soll/Ist-Kalkulation",
  [FEATURES.M6_WAREHOUSE]: "M6 Lager",
  [FEATURES.M7_FUNDING]: "M7 Förderungsmanagement",
  [FEATURES.M8_HEAT_LOAD]: "M8 Heizlast-Anbindung",
  [FEATURES.M9_MANUFACTURER_API]: "M9 Hersteller-APIs",
  [FEATURES.M10_DATEV]: "M10 DATEV/RZL/BMD",
  [FEATURES.M11_SEPA]: "M11 SEPA & Mahnwesen",
  [FEATURES.M12_FLOW_AI]: "M12 FlowAI",
  [FEATURES.M13_CHECKLISTS]: "M13 Checklisten",
  [FEATURES.M14_KANBAN]: "M14 Kanban + Chat",
};

export default async function SettingsPage() {
  const trpc = await getTrpcCaller();
  const [tenant, members, features, pipelineStages] = await Promise.all([
    trpc.tenant.current(),
    trpc.tenant.members(),
    trpc.tenant.features(),
    trpc.tenant.pipelineStages(),
  ]);

  return (
    <>
      <PageHeader
        title="Einstellungen"
        description={tenant?.name ?? ""}
        actions={
          <a href="/settings/billing"><button className="h-9 px-4 text-sm rounded border border-border bg-card hover:bg-muted/30">Abrechnung & Module →</button></a>
        }
      />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader><CardTitle>Betrieb</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Name" value={tenant?.name} />
            <Field label="UID/UStId" value={tenant?.vatId} />
            <Field label="E-Mail" value={tenant?.email} />
            <Field label="Telefon" value={tenant?.phone} />
            <Field label="Adresse" value={`${tenant?.addressStreet ?? ""}, ${tenant?.addressZip ?? ""} ${tenant?.addressCity ?? ""}`} />
            <Field label="Land / Währung" value={`${tenant?.country} · ${tenant?.currency}`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Team ({members.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border -mx-2">
              {members.map((m) => (
                <li key={m.id} className="px-2 py-3 flex items-center gap-3">
                  <Avatar name={m.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-fg truncate">{m.email}</div>
                  </div>
                  <Badge tone={m.role === "owner" ? "primary" : "neutral"}>{m.role}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Module ({features.length} aktiv)</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
            {features.map((f) => (
              <div key={f.featureKey} className="flex items-center justify-between py-1.5 px-3 rounded border border-border bg-muted/30">
                <span>{FEATURE_LABELS[f.featureKey] ?? f.featureKey}</span>
                <Badge tone={CORE_FEATURES.includes(f.featureKey) ? "success" : "primary"}>
                  {CORE_FEATURES.includes(f.featureKey) ? "Core" : "Modul"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <PipelineStagesEditor initialStages={pipelineStages} />

        <DatevExportCard />
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-fg uppercase">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
    </div>
  );
}

import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, DataTable, EmptyState, PageHeader } from "@heatflow/ui";
import { FileSpreadsheet } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf", submitted: "Eingereicht", approved: "Bewilligt", rejected: "Abgelehnt", paid: "Ausbezahlt",
};
const STATUS_TONE: Record<string, "neutral" | "primary" | "success" | "danger"> = {
  draft: "neutral", submitted: "primary", approved: "success", rejected: "danger", paid: "success",
};

export default async function FundingPage() {
  const trpc = await getTrpcCaller();
  const [tenant, apps, programs] = await Promise.all([
    trpc.tenant.current(),
    trpc.funding.applicationsList({}),
    trpc.funding.programs(),
  ]);

  const totalRequested = apps.reduce((s, a) => s + Number(a.amountRequested ?? 0), 0);
  const totalApproved = apps.reduce((s, a) => s + Number(a.amountApproved ?? 0), 0);
  const totalPaid = apps.filter((a) => a.status === "paid").reduce((s, a) => s + Number(a.amountApproved ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Förderungen"
        description={tenant ? `Verfügbare Programme und Anträge für ${tenant.country === "DE" ? "Deutschland" : tenant.country === "AT" ? "Österreich" : tenant.country}` : ""}
      />
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid sm:grid-cols-4 gap-3">
          <Kpi label="Aktive Programme" value={String(programs.length)} />
          <Kpi label="Anträge gesamt" value={String(apps.length)} />
          <Kpi label="Beantragt" value={formatMoney(totalRequested)} />
          <Kpi label="Bewilligt / Ausbezahlt" value={formatMoney(totalApproved)} sub={totalPaid > 0 ? `${formatMoney(totalPaid)} bereits ausbezahlt` : undefined} tone={totalApproved > 0 ? "success" : undefined} />
        </div>

        <Card>
          <CardHeader><CardTitle>Verfügbare Programme</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {programs.map((p) => (
                <div key={p.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{p.name}</div>
                    <Badge>{p.country}</Badge>
                  </div>
                  {p.description && <div className="text-sm text-muted-fg mt-1">{p.description}</div>}
                  {p.maxAmount && (
                    <div className="text-xs text-muted-fg mt-2">max. {formatMoney(Number(p.maxAmount))}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alle Anträge ({apps.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={apps}
              rowKey={(a) => a.id}
              empty={<EmptyState icon={<FileSpreadsheet className="size-5" />} title="Noch keine Anträge" description={'Erstelle Anträge direkt aus dem Projekt-Detail → Tab „Förderung".'} />}
              columns={[
                { id: "project", header: "Projekt", cell: (a) => (
                  <Link href={`/projects/${a.projectId}`} className="font-medium hover:underline">
                    {a.projectTitle}
                  </Link>
                )},
                { id: "program", header: "Programm", cell: (a) => a.programName },
                { id: "requested", header: "Beantragt", align: "right", width: "120px", cell: (a) => <span className="tabular-nums">{formatMoney(Number(a.amountRequested ?? 0))}</span> },
                { id: "approved", header: "Bewilligt", align: "right", width: "120px", cell: (a) => a.amountApproved !== null ? <span className="tabular-nums text-success">{formatMoney(Number(a.amountApproved))}</span> : <span className="text-muted-fg">—</span> },
                { id: "status", header: "Status", width: "120px", cell: (a) => <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge> },
                { id: "submitted", header: "Eingereicht", width: "120px", cell: (a) => a.submittedAt ? <span className="text-xs text-muted-fg">{formatDate(a.submittedAt)}</span> : <span className="text-muted-fg">—</span> },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tone === "success" ? "text-success" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-fg mt-0.5">{sub}</div>}
    </div>
  );
}

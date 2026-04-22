import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heatflow/ui";
import { CheckCircle2, Circle, Package } from "lucide-react";
import { formatAgo, formatDate, formatMoney } from "@heatflow/utils";
import { CompleteVisitButton } from "../_components/CompleteVisitButton";

export const dynamic = "force-dynamic";

const ASSET_TYPE_LABEL: Record<string, string> = {
  heat_pump: "Wärmepumpe",
  buffer: "Pufferspeicher",
  dhw: "Warmwasser",
  pv: "PV-Anlage",
  meter: "Stromzähler",
  boiler: "Heizkessel",
  other: "Sonstige",
};

export default async function MaintenanceContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getTrpcCaller();
  let contract;
  try { contract = await trpc.maintenance.contractById({ id }); } catch { notFound(); }

  const contactName =
    (contract.contact?.companyName ?? `${contract.contact?.firstName ?? ""} ${contract.contact?.lastName ?? ""}`.trim()) || "—";

  const nextVisit = contract.visits.find((v) => !v.completedAt);

  return (
    <>
      <PageHeader
        title={contract.name}
        description={`Wartungsvertrag · ${contactName}`}
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {contract.autoRenewal && <Badge tone="success">Auto-Verlängerung</Badge>}
          <Badge>Intervall: {contract.intervalMonths} Monate</Badge>
          {contract.nextDueDate && (
            <Badge tone="primary">Nächste: {formatDate(contract.nextDueDate)}</Badge>
          )}
          <Badge>Preis: {formatMoney(Number(contract.price))}</Badge>
        </div>
      </PageHeader>

      <div className="p-6 max-w-5xl mx-auto grid gap-6 lg:grid-cols-3">
        {/* Left: Asset info */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Anlage</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {contract.asset ? (
              <>
                <div className="flex items-center gap-2">
                  <Package className="size-5 text-primary" />
                  <div>
                    <div className="font-medium">{contract.asset.brand} {contract.asset.model}</div>
                    <div className="text-xs text-muted-fg">{ASSET_TYPE_LABEL[contract.asset.assetType]}</div>
                  </div>
                </div>
                {contract.asset.serialNumber && (
                  <div className="pt-2 border-t border-border">
                    <div className="text-xs text-muted-fg">Seriennr.</div>
                    <div className="font-mono text-xs">{contract.asset.serialNumber}</div>
                  </div>
                )}
                {contract.asset.powerKw && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                    <div>
                      <div className="text-xs text-muted-fg">Leistung</div>
                      <div>{Number(contract.asset.powerKw)} kW</div>
                    </div>
                    {contract.asset.cop && (
                      <div>
                        <div className="text-xs text-muted-fg">COP</div>
                        <div>{Number(contract.asset.cop)}</div>
                      </div>
                    )}
                    {contract.asset.refrigerant && (
                      <div>
                        <div className="text-xs text-muted-fg">Kältemittel</div>
                        <div>{contract.asset.refrigerant}</div>
                      </div>
                    )}
                    {contract.asset.soundLevelDb && (
                      <div>
                        <div className="text-xs text-muted-fg">Schall</div>
                        <div>{Number(contract.asset.soundLevelDb)} dB(A)</div>
                      </div>
                    )}
                  </div>
                )}
                {contract.asset.installationDate && (
                  <div className="pt-2 border-t border-border text-xs">
                    <div className="text-muted-fg">Installiert</div>
                    <div>{formatDate(contract.asset.installationDate)}</div>
                  </div>
                )}
                {contract.asset.warrantyUntil && (
                  <div className="text-xs">
                    <div className="text-muted-fg">Garantie bis</div>
                    <div>{formatDate(contract.asset.warrantyUntil)}</div>
                  </div>
                )}
                {contract.asset.locationDescription && (
                  <div className="pt-2 border-t border-border text-xs">
                    <div className="text-muted-fg">Standort</div>
                    <div>{contract.asset.locationDescription}</div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-fg">Keine Anlage verknüpft.</p>
            )}
          </CardContent>
        </Card>

        {/* Right: Visits timeline + next action */}
        <div className="lg:col-span-2 space-y-6">
          {nextVisit && (
            <Card>
              <CardHeader><CardTitle>Nächster Termin</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">{formatDate(nextVisit.scheduledAt)}</div>
                  <div className="text-sm text-muted-fg">
                    {new Date(nextVisit.scheduledAt).getTime() < Date.now()
                      ? <span className="text-danger">Überfällig</span>
                      : `in ${Math.ceil((new Date(nextVisit.scheduledAt).getTime() - Date.now()) / 86400000)} Tagen`}
                  </div>
                </div>
                <CompleteVisitButton visitId={nextVisit.id} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Wartungshistorie ({contract.visits.length})</CardTitle></CardHeader>
            <CardContent>
              {contract.visits.length === 0 ? (
                <p className="text-sm text-muted-fg">Noch keine Wartungstermine.</p>
              ) : (
                <ol className="relative border-l border-border ml-3 space-y-5 py-2">
                  {contract.visits.map((v) => {
                    const done = !!v.completedAt;
                    return (
                      <li key={v.id} className="ml-6">
                        <span className={`absolute -left-1.5 mt-1.5 size-3 rounded-full ring-4 ring-bg ${done ? "bg-success" : "bg-muted-fg"}`} />
                        <div className="flex items-center gap-2 text-sm">
                          {done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-fg" />}
                          <span className="font-medium">{formatDate(v.scheduledAt)}</span>
                          {done && v.completedAt && (
                            <Badge tone="success">abgeschlossen {formatAgo(v.completedAt)}</Badge>
                          )}
                          {v.technicianName && <span className="text-xs text-muted-fg">· {v.technicianName}</span>}
                        </div>
                        {v.issuesFound && (
                          <div className="text-xs text-danger mt-1">Mängel: {v.issuesFound}</div>
                        )}
                        {done && v.protocol && typeof v.protocol === "object" && "checks" in v.protocol && Array.isArray((v.protocol as { checks?: unknown[] }).checks) && (
                          <ul className="mt-1 text-xs text-muted-fg space-y-0.5">
                            {(v.protocol as { checks: string[] }).checks.map((c, i) => (
                              <li key={i} className="flex items-center gap-1.5">
                                <CheckCircle2 className="size-3 text-success flex-shrink-0" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

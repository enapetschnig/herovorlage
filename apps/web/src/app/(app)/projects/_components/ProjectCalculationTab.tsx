"use client";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, FieldGroup, Input } from "@heatflow/ui";
import { formatMoney } from "@heatflow/utils";
import { toast } from "sonner";
import { Edit2, Loader2, Save, X } from "lucide-react";

export function ProjectCalculationTab({ projectId }: { projectId: string }) {
  const q = trpc.calculation.forProject.useQuery({ projectId });
  const save = trpc.calculation.savePlan.useMutation({
    onSuccess: () => { toast.success("Planung gespeichert"); q.refetch(); setEdit(false); },
    onError: (e) => toast.error(e.message),
  });

  const [edit, setEdit] = useState(false);
  const [planned, setPlanned] = useState({ hours: 0, materialCost: 0, totalCost: 0, revenue: 0 });

  useEffect(() => {
    if (q.data) {
      setPlanned({
        hours: q.data.planned.hours,
        materialCost: q.data.planned.materialCost,
        totalCost: q.data.planned.totalCost || (q.data.planned.materialCost + (q.data.planned.hours * 60)),
        revenue: q.data.planned.revenue,
      });
    }
  }, [q.data]);

  if (q.isLoading || !q.data) {
    return <div className="flex items-center justify-center py-12 text-muted-fg"><Loader2 className="size-5 animate-spin" /></div>;
  }

  const plannedRevenue = planned.revenue;
  const actualRevenue = q.data.actual.revenue;
  const plannedMargin = plannedRevenue - planned.totalCost;
  const actualMargin = actualRevenue - q.data.actual.totalCost;

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Kpi label="Stunden Ist" value={`${q.data.actual.hours.toFixed(1)} h`} sub={planned.hours > 0 ? `von ${planned.hours.toFixed(1)} geplant` : undefined} over={planned.hours > 0 && q.data.actual.hours > planned.hours} />
        <Kpi label="Material Ist" value={formatMoney(q.data.actual.materialCost)} sub={planned.materialCost > 0 ? `von ${formatMoney(planned.materialCost)}` : undefined} over={planned.materialCost > 0 && q.data.actual.materialCost > planned.materialCost} />
        <Kpi label="Umsatz Ist" value={formatMoney(actualRevenue)} sub={plannedRevenue > 0 ? `von ${formatMoney(plannedRevenue)}` : undefined} />
        <Kpi label="Ertrag Ist" value={formatMoney(actualMargin)} sub={plannedMargin !== 0 ? `Plan ${formatMoney(plannedMargin)}` : undefined} over={actualMargin < 0} good={actualMargin > 0} />
      </div>

      {/* Comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Soll/Ist-Vergleich</span>
            {!edit ? (
              <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
                <Edit2 className="size-3.5" /> Planung bearbeiten
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEdit(false)}><X className="size-3.5" /> Abbrechen</Button>
                <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ projectId, plannedHours: planned.hours, plannedMaterialCost: planned.materialCost, plannedTotalCost: planned.totalCost, plannedRevenue: planned.revenue })}>
                  {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Speichern
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {edit ? (
            <FieldGroup columns={2}>
              <Field label="Geplante Stunden">
                <Input type="number" step="0.5" value={planned.hours} onChange={(e) => setPlanned({ ...planned, hours: Number(e.target.value) })} />
              </Field>
              <Field label="Geplantes Material (€)">
                <Input type="number" step="0.01" value={planned.materialCost} onChange={(e) => setPlanned({ ...planned, materialCost: Number(e.target.value) })} />
              </Field>
              <Field label="Geplante Gesamtkosten (€)" hint="Material + Lohn + Nebenkosten">
                <Input type="number" step="0.01" value={planned.totalCost} onChange={(e) => setPlanned({ ...planned, totalCost: Number(e.target.value) })} />
              </Field>
              <Field label="Geplanter Umsatz (€)" hint="Netto, aus dem Angebot">
                <Input type="number" step="0.01" value={planned.revenue} onChange={(e) => setPlanned({ ...planned, revenue: Number(e.target.value) })} />
              </Field>
            </FieldGroup>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-fg uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="text-left py-2">Position</th>
                  <th className="text-right py-2 w-[140px]">Soll</th>
                  <th className="text-right py-2 w-[140px]">Ist</th>
                  <th className="text-right py-2 w-[140px]">Delta</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Stunden" soll={`${planned.hours.toFixed(1)} h`} ist={`${q.data.actual.hours.toFixed(1)} h`} delta={q.data.actual.hours - planned.hours} unit="h" />
                <Row label="Lohnkosten" soll={formatMoney(planned.hours * 40)} ist={formatMoney(q.data.actual.laborCost)} delta={q.data.actual.laborCost - planned.hours * 40} />
                <Row label="Materialkosten" soll={formatMoney(planned.materialCost)} ist={formatMoney(q.data.actual.materialCost)} delta={q.data.actual.materialCost - planned.materialCost} />
                <Row label="Gesamtkosten" soll={formatMoney(planned.totalCost)} ist={formatMoney(q.data.actual.totalCost)} delta={q.data.actual.totalCost - planned.totalCost} strong />
                <Row label="Umsatz" soll={formatMoney(plannedRevenue)} ist={formatMoney(actualRevenue)} delta={actualRevenue - plannedRevenue} strong invertGood />
                <Row label="Ertrag / Marge" soll={formatMoney(plannedMargin)} ist={formatMoney(actualMargin)} delta={actualMargin - plannedMargin} strong invertGood />
              </tbody>
            </table>
          )}

          <p className="text-xs text-muted-fg mt-4 pt-3 border-t border-border">
            Ist-Stunden aus Zeiterfassung (alle Einträge). Ist-Lohnkosten = Stunden × ⌀-Stundensatz der Lohngruppen. Ist-Material = Artikelpositionen × Einkaufspreis. Ist-Umsatz = Summe der Netto-Beträge aller Rechnungen an dieses Projekt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, over, good }: { label: string; value: string; sub?: string; over?: boolean; good?: boolean }) {
  const toneClass = over ? "text-danger" : good ? "text-success" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted-fg mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, soll, ist, delta, strong, unit, invertGood }: {
  label: string; soll: string; ist: string; delta: number; strong?: boolean; unit?: string; invertGood?: boolean;
}) {
  const goodDelta = invertGood ? delta > 0 : delta < 0;
  const badDelta = invertGood ? delta < 0 : delta > 0;
  const deltaStr = (delta >= 0 ? "+" : "−") + (Math.abs(delta).toLocaleString("de-AT", { maximumFractionDigits: 2 })) + (unit ? ` ${unit}` : " €");
  return (
    <tr className={`border-b border-border last:border-0 ${strong ? "font-semibold" : ""}`}>
      <td className="py-2">{label}</td>
      <td className="py-2 text-right tabular-nums text-muted-fg">{soll}</td>
      <td className="py-2 text-right tabular-nums">{ist}</td>
      <td className={`py-2 text-right tabular-nums ${goodDelta ? "text-success" : badDelta ? "text-danger" : ""}`}>
        {delta === 0 ? "—" : deltaStr}
      </td>
    </tr>
  );
}

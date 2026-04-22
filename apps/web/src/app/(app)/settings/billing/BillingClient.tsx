"use client";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { formatMoney, formatDate } from "@heatflow/utils";
import { CORE_FEATURES, FEATURES, type FeatureKey } from "@heatflow/utils/constants";
import { CheckCircle2, ExternalLink, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

type LineItem = { label: string; qty: number; unit: number; total: number; kind: "core" | "module" };
type Overview = {
  tenant: { plan: string; trialEndsAt: Date | null; billingEmail: string | null; currentPeriodEnd: Date | null; stripeCustomerId: string | null };
  users: number;
  lineItems: LineItem[];
  totalMonthly: number;
  totalYearly: number;
  stripeConfigured: boolean;
};

const ALL_MODULES: { key: FeatureKey; label: string; price: string; recommended?: boolean }[] = [
  { key: FEATURES.M1_DATANORM, label: "Datanorm-Import", price: "€9" },
  { key: FEATURES.M2_IDS_CONNECT, label: "IDS Connect", price: "€19" },
  { key: FEATURES.M3_MAINTENANCE, label: "Wartungsverträge & Anlagen", price: "€15", recommended: true },
  { key: FEATURES.M4_PLANNING, label: "Plantafel", price: "€12/User" },
  { key: FEATURES.M5_CALCULATION, label: "Soll/Ist-Kalkulation", price: "€10" },
  { key: FEATURES.M6_WAREHOUSE, label: "Lagerverwaltung", price: "€15" },
  { key: FEATURES.M7_FUNDING, label: "Förderungsmanagement", price: "€19", recommended: true },
  { key: FEATURES.M8_HEAT_LOAD, label: "Heizlast-Anbindung", price: "€9" },
  { key: FEATURES.M9_MANUFACTURER_API, label: "Hersteller-APIs", price: "€19" },
  { key: FEATURES.M10_DATEV, label: "DATEV Export", price: "€15" },
  { key: FEATURES.M11_SEPA, label: "SEPA & Mahnwesen", price: "€12" },
  { key: FEATURES.M12_FLOW_AI, label: "FlowAI", price: "€29/User", recommended: true },
  { key: FEATURES.M13_CHECKLISTS, label: "Checklisten", price: "€9" },
  { key: FEATURES.M14_KANBAN, label: "Kanban + Chat", price: "€9" },
];

const PLAN_LABEL: Record<string, string> = {
  demo: "Demo (kostenlos)",
  trial: "Test-Phase (30 Tage)",
  active: "Aktiv",
  past_due: "Zahlung offen",
  cancelled: "Gekündigt",
};
const PLAN_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger"> = {
  demo: "neutral", trial: "primary", active: "success", past_due: "warning", cancelled: "danger",
};

export function BillingClient({
  initialOverview, initialFeatures,
}: {
  initialOverview: Overview;
  initialFeatures: { featureKey: string; active: boolean }[];
}) {
  const router = useRouter();
  const overview = trpc.billing.overview.useQuery(undefined, { initialData: initialOverview });
  const featuresQ = trpc.tenant.features.useQuery(undefined, { initialData: initialFeatures as never });

  const setModule = trpc.billing.setModule.useMutation({
    onSuccess: ({ featureKey, active }) => {
      toast.success(active ? `${featureKey} aktiviert` : `${featureKey} deaktiviert`);
      overview.refetch();
      featuresQ.refetch();
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const startTrial = trpc.billing.startTrial.useMutation({
    onSuccess: () => { toast.success("30-Tage-Test gestartet"); overview.refetch(); router.refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const openPortal = trpc.billing.openBillingPortal.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e) => toast.error(e.message),
  });

  const data = overview.data ?? initialOverview;
  const activeFeatures = new Set((featuresQ.data ?? []).filter((f: { active: boolean }) => f.active).map((f: { featureKey: string }) => f.featureKey));

  return (
    <div className="space-y-6">
      {/* Plan summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Aktueller Plan</span>
            <Badge tone={PLAN_TONE[data.tenant.plan] ?? "neutral"}>{PLAN_LABEL[data.tenant.plan] ?? data.tenant.plan}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <Kpi label="Aktive User" value={String(data.users)} />
            <Kpi label="Aktive Module" value={String(data.lineItems.filter((l) => l.kind === "module").length)} />
            <Kpi label="Monatlich" value={formatMoney(data.totalMonthly)} accent="primary" />
          </div>
          {data.tenant.trialEndsAt && (
            <div className="text-xs text-warning bg-warning/10 border border-warning/20 rounded p-2.5">
              Test-Phase läuft bis {formatDate(data.tenant.trialEndsAt)}. Danach automatischer Wechsel auf „Aktiv" — entsprechend wird das Stripe-Abo gestartet.
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {data.tenant.plan === "demo" && (
              <Button onClick={() => startTrial.mutate()} disabled={startTrial.isPending}>
                {startTrial.isPending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} 30 Tage gratis testen
              </Button>
            )}
            {(data.tenant.plan === "trial" || data.tenant.plan === "active") && (
              <Button
                variant="secondary"
                onClick={() => openPortal.mutate()}
                disabled={openPortal.isPending}
              >
                {openPortal.isPending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />} Stripe-Portal öffnen
              </Button>
            )}
            {!data.stripeConfigured && (
              <span className="text-xs text-muted-fg flex items-center">
                ⚠ Stripe nicht konfiguriert — Module sind im Demo-Modus kostenlos
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost breakdown */}
      <Card>
        <CardHeader><CardTitle>Aufschlüsselung</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-fg">
              <tr>
                <th className="text-left px-4 py-2.5">Position</th>
                <th className="text-right px-4 py-2.5 w-[100px]">Menge</th>
                <th className="text-right px-4 py-2.5 w-[100px]">Einzel</th>
                <th className="text-right px-4 py-2.5 w-[100px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    {l.label} {l.kind === "core" && <Badge>Core</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.qty}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(l.unit)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(l.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                <td className="px-4 py-3" colSpan={3}>Pro Monat</td>
                <td className="px-4 py-3 text-right tabular-nums text-base">{formatMoney(data.totalMonthly)}</td>
              </tr>
              <tr className="border-t border-border text-xs text-muted-fg">
                <td className="px-4 py-2" colSpan={3}>Pro Jahr</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totalYearly)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Module toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Module aktivieren / deaktivieren</CardTitle>
          <p className="text-sm text-muted-fg">Im Demo-Plan kostenlos. Im aktiven Plan wird Stripe-Subscription entsprechend angepasst.</p>
        </CardHeader>
        <CardContent>
          <ul className="grid sm:grid-cols-2 gap-2">
            {ALL_MODULES.map((m) => {
              const isActive = activeFeatures.has(m.key);
              const isCore = CORE_FEATURES.includes(m.key);
              return (
                <li key={m.key}>
                  <label className={`flex items-center gap-3 px-3 py-2.5 rounded border ${isActive ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      disabled={isCore || setModule.isPending}
                      onChange={(e) => setModule.mutate({ featureKey: m.key, active: e.target.checked })}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {m.label}
                        {m.recommended && <Sparkles className="size-3 text-primary" />}
                        {isCore && <Badge tone="success">Core</Badge>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-fg tabular-nums">{m.price}</div>
                    {isActive && <CheckCircle2 className="size-4 text-success" />}
                  </label>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "primary" }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${accent === "primary" ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, FieldGroup, Input } from "@heatflow/ui";
import { toast } from "sonner";
import { Loader2, Package, Plus, Trash2, X } from "lucide-react";
import { formatDate } from "@heatflow/utils";

const ASSET_TYPE_LABEL: Record<string, string> = {
  heat_pump: "Wärmepumpe",
  buffer: "Pufferspeicher",
  dhw: "Warmwasser",
  pv: "PV-Anlage",
  meter: "Stromzähler",
  boiler: "Heizkessel",
  other: "Sonstige",
};

export function ContactAssetsCard({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const q = trpc.maintenance.listAssetsByContact.useQuery({ contactId });
  const create = trpc.maintenance.createAsset.useMutation({
    onSuccess: () => {
      toast.success("Anlage angelegt");
      setOpen(false);
      q.refetch();
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.maintenance.removeAsset.useMutation({
    onSuccess: () => { toast.success("Gelöscht"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Package className="size-4" /> Anlagen</span>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Anlage
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="text-sm text-muted-fg py-2"><Loader2 className="size-4 animate-spin inline" /> lade…</div>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-fg py-2">
            Keine Anlagen hinterlegt. Wärmepumpe, Pufferspeicher, PV-Anlage etc. hier erfassen.
          </p>
        ) : (
          <ul className="divide-y divide-border -mx-2">
            {q.data!.map((a) => (
              <li key={a.id} className="px-2 py-3 flex items-start gap-3">
                <div className="size-8 rounded bg-primary/10 text-primary grid place-items-center flex-shrink-0">
                  <Package className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {a.brand} {a.model} <span className="text-muted-fg font-normal">· {ASSET_TYPE_LABEL[a.assetType] ?? a.assetType}</span>
                  </div>
                  <div className="text-xs text-muted-fg space-x-2">
                    {a.powerKw && <span>{Number(a.powerKw)} kW</span>}
                    {a.cop && <span>COP {Number(a.cop)}</span>}
                    {a.refrigerant && <span>{a.refrigerant}</span>}
                    {a.serialNumber && <span className="font-mono">· {a.serialNumber}</span>}
                  </div>
                  {a.installationDate && (
                    <div className="text-xs text-muted-fg">Installiert {formatDate(a.installationDate)}</div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!window.confirm("Anlage wirklich entfernen?")) return;
                    remove.mutate({ id: a.id });
                  }}
                  className="p-1.5 rounded hover:bg-danger/10 text-danger"
                  aria-label="Entfernen"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {open && (
        <AssetDialog
          contactId={contactId}
          onClose={() => setOpen(false)}
          onSubmit={(v) => create.mutate(v)}
          submitting={create.isPending}
        />
      )}
    </Card>
  );
}

function AssetDialog({
  contactId, onClose, onSubmit, submitting,
}: {
  contactId: string;
  onClose: () => void;
  onSubmit: (v: {
    contactId: string;
    assetType: "heat_pump" | "buffer" | "dhw" | "pv" | "meter" | "boiler" | "other";
    brand?: string; model?: string; serialNumber?: string;
    installationDate?: string; warrantyUntil?: string;
    powerKw?: number; cop?: number; refrigerant?: string; soundLevelDb?: number;
    locationDescription?: string;
  }) => void;
  submitting: boolean;
}) {
  const [state, setState] = useState({
    assetType: "heat_pump" as const,
    brand: "",
    model: "",
    serialNumber: "",
    installationDate: "",
    warrantyUntil: "",
    powerKw: "",
    cop: "",
    refrigerant: "R290",
    locationDescription: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      contactId,
      assetType: state.assetType,
      brand: state.brand || undefined,
      model: state.model || undefined,
      serialNumber: state.serialNumber || undefined,
      installationDate: state.installationDate || undefined,
      warrantyUntil: state.warrantyUntil || undefined,
      powerKw: state.powerKw ? Number(state.powerKw) : undefined,
      cop: state.cop ? Number(state.cop) : undefined,
      refrigerant: state.refrigerant || undefined,
      locationDescription: state.locationDescription || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <header className="sticky top-0 bg-card z-10 flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Anlage anlegen</h2>
          <button onClick={onClose} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg">
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-3">
          <Field label="Typ">
            <select
              value={state.assetType}
              onChange={(e) => setState({ ...state, assetType: e.target.value as typeof state.assetType })}
              className="h-9 px-3 rounded border border-input bg-bg text-sm w-full"
            >
              {Object.entries(ASSET_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <FieldGroup columns={2}>
            <Field label="Marke"><Input value={state.brand} onChange={(e) => setState({ ...state, brand: e.target.value })} placeholder="z.B. Viessmann" /></Field>
            <Field label="Modell"><Input value={state.model} onChange={(e) => setState({ ...state, model: e.target.value })} placeholder="z.B. Vitocal 350-A" /></Field>
            <Field label="Seriennummer"><Input value={state.serialNumber} onChange={(e) => setState({ ...state, serialNumber: e.target.value })} className="font-mono" /></Field>
            <Field label="Kältemittel">
              <select value={state.refrigerant} onChange={(e) => setState({ ...state, refrigerant: e.target.value })} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
                <option value="R290">R290 (Propan)</option>
                <option value="R32">R32</option>
                <option value="R410A">R410A</option>
                <option value="R454C">R454C</option>
                <option value="">(keines / nicht zutreffend)</option>
              </select>
            </Field>
            <Field label="Leistung (kW)"><Input type="number" step="0.1" value={state.powerKw} onChange={(e) => setState({ ...state, powerKw: e.target.value })} /></Field>
            <Field label="COP"><Input type="number" step="0.1" value={state.cop} onChange={(e) => setState({ ...state, cop: e.target.value })} /></Field>
            <Field label="Installiert am"><Input type="date" value={state.installationDate} onChange={(e) => setState({ ...state, installationDate: e.target.value })} /></Field>
            <Field label="Garantie bis"><Input type="date" value={state.warrantyUntil} onChange={(e) => setState({ ...state, warrantyUntil: e.target.value })} /></Field>
          </FieldGroup>
          <Field label="Standort-Beschreibung (optional)">
            <Input value={state.locationDescription} onChange={(e) => setState({ ...state, locationDescription: e.target.value })} placeholder="z.B. Heizraum UG" />
          </Field>

          <footer className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Anlegen
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

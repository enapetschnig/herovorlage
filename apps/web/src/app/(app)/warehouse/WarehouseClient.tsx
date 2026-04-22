"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Field, FieldGroup, Input } from "@heatflow/ui";
import { formatMoney } from "@heatflow/utils";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, Package, Plus, Settings, X } from "lucide-react";

type Warehouse = { id: string; name: string; address: string | null; itemCount: number; valueSum: number };
type StockItem = {
  id: string; warehouseId: string; warehouseName: string | null;
  articleId: string; articleNumber: string | null; articleName: string | null; articleUnit: string | null;
  quantity: string; reserved: string; minStock: string | null; locationCode: string | null;
  purchasePrice: string | null;
};
type LowStockItem = { id: string; articleName: string | null; articleNumber: string | null; warehouseName: string | null; quantity: string; minStock: string | null; deficit: number };

export function WarehouseClient({
  initialWarehouses, initialItems, initialLowStock,
}: {
  initialWarehouses: Warehouse[];
  initialItems: StockItem[];
  initialLowStock: LowStockItem[];
}) {
  const router = useRouter();
  const [activeWarehouse, setActiveWarehouse] = useState<string>(initialWarehouses[0]?.id ?? "");
  const [newWarehouseOpen, setNewWarehouseOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState<StockItem | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);

  const warehouses = trpc.warehouse.warehousesList.useQuery(undefined, { initialData: initialWarehouses });
  const items = trpc.warehouse.stockItems.useQuery(
    { warehouseId: activeWarehouse || undefined },
    { initialData: activeWarehouse ? initialItems.filter((i) => i.warehouseId === activeWarehouse) : initialItems },
  );
  const lowStock = trpc.warehouse.belowMinStock.useQuery(undefined, {
    initialData: initialLowStock.map((i) => ({ ...i, deficit: String(i.deficit) })) as never,
  });

  const createWarehouse = trpc.warehouse.createWarehouse.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Lager angelegt");
      setActiveWarehouse(id);
      setNewWarehouseOpen(false);
      warehouses.refetch();
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const recordMovement = trpc.warehouse.recordMovement.useMutation({
    onSuccess: () => {
      toast.success("Bewegung gebucht");
      setMovementOpen(null);
      items.refetch();
      lowStock.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertStock = trpc.warehouse.upsertStock.useMutation({
    onSuccess: () => {
      toast.success("Artikel ins Lager aufgenommen");
      setAddStockOpen(false);
      items.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const totalValue = (warehouses.data ?? []).reduce((s, w) => s + Number(w.valueSum), 0);

  if ((warehouses.data ?? []).length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<Package className="size-5" />}
            title="Noch kein Lager angelegt"
            description="Lege das erste Lager an, um Artikel-Bestände zu tracken."
            action={<Button onClick={() => setNewWarehouseOpen(true)}><Plus className="size-4" /> Lager anlegen</Button>}
          />
        </CardContent>
        <NewWarehouseDialog open={newWarehouseOpen} onClose={() => setNewWarehouseOpen(false)} onSubmit={(v) => createWarehouse.mutate(v)} pending={createWarehouse.isPending} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <Kpi label="Lagerorte" value={String((warehouses.data ?? []).length)} />
        <Kpi label="Gesamtwert (EK)" value={formatMoney(totalValue)} />
        <Kpi label="Unter Mindestbestand" value={String((lowStock.data ?? []).length)} accent={(lowStock.data ?? []).length > 0 ? "warning" : "success"} />
      </div>

      {(lowStock.data ?? []).length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" /> Bestand unter Mindestmenge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {(lowStock.data as unknown as LowStockItem[] ?? []).map((i) => (
                <li key={i.id} className="flex items-center justify-between">
                  <span><strong>{i.articleName}</strong> in {i.warehouseName} — {Number(i.quantity)} (Min: {i.minStock})</span>
                  <Badge tone="danger">−{Number(i.deficit)}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Warehouse tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(warehouses.data ?? []).map((w) => (
          <button
            key={w.id}
            onClick={() => setActiveWarehouse(w.id)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${activeWarehouse === w.id ? "bg-primary text-primary-fg" : "bg-muted hover:bg-muted/70"}`}
          >
            {w.name}
            <span className={`ml-2 text-xs ${activeWarehouse === w.id ? "opacity-80" : "text-muted-fg"}`}>{w.itemCount}</span>
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setNewWarehouseOpen(true)}><Plus className="size-3.5" /> Lager</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bestände {activeWarehouse && `— ${(warehouses.data ?? []).find((w) => w.id === activeWarehouse)?.name}`}</span>
            <Button size="sm" onClick={() => setAddStockOpen(true)} disabled={!activeWarehouse}>
              <Plus className="size-4" /> Artikel ins Lager
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(items.data ?? []).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-fg">
              Noch keine Bestände in diesem Lager. Klick „Artikel ins Lager" um zu starten.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-fg">
                <tr>
                  <th className="text-left px-4 py-2.5">Artikel</th>
                  <th className="text-left px-4 py-2.5 w-[100px]">Standort</th>
                  <th className="text-right px-4 py-2.5 w-[120px]">Bestand</th>
                  <th className="text-right px-4 py-2.5 w-[100px]">Reserviert</th>
                  <th className="text-right px-4 py-2.5 w-[100px]">Min</th>
                  <th className="text-right px-4 py-2.5 w-[100px]">Wert (EK)</th>
                  <th className="text-right px-4 py-2.5 w-[200px]">Bewegung</th>
                </tr>
              </thead>
              <tbody>
                {items.data!.map((i) => {
                  const qty = Number(i.quantity);
                  const min = i.minStock ? Number(i.minStock) : null;
                  const below = min !== null && qty < min;
                  const value = qty * Number(i.purchasePrice ?? 0);
                  return (
                    <tr key={i.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.articleName}</div>
                        <code className="text-xs text-muted-fg">{i.articleNumber}</code>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-fg">{i.locationCode ?? "—"}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-medium ${below ? "text-danger" : ""}`}>
                        {qty} {i.articleUnit}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-fg">{Number(i.reserved) || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-fg">{min ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMoney(value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setMovementOpen(i)}>
                            <ArrowDown className="size-3" /> <ArrowUp className="size-3" /> Bewegung
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <NewWarehouseDialog open={newWarehouseOpen} onClose={() => setNewWarehouseOpen(false)} onSubmit={(v) => createWarehouse.mutate(v)} pending={createWarehouse.isPending} />
      {movementOpen && (
        <MovementDialog
          item={movementOpen}
          onClose={() => setMovementOpen(null)}
          onSubmit={(v) => recordMovement.mutate(v)}
          pending={recordMovement.isPending}
        />
      )}
      {addStockOpen && (
        <AddStockDialog
          warehouseId={activeWarehouse}
          onClose={() => setAddStockOpen(false)}
          onSubmit={(v) => upsertStock.mutate(v)}
          pending={upsertStock.isPending}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "warning" | "success" }) {
  const cls = accent === "warning" ? "text-warning" : accent === "success" ? "text-success" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

function NewWarehouseDialog({ open, onClose, onSubmit, pending }: { open: boolean; onClose: () => void; onSubmit: (v: { name: string; address?: string }) => void; pending: boolean }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  if (!open) return null;
  return (
    <DialogShell title="Neues Lager" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, address: address || undefined }); }} className="p-5 space-y-3">
        <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Werkstatt Klagenfurt" required autoFocus /></Field>
        <Field label="Adresse (optional)"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Straße, PLZ Ort" /></Field>
        <FooterButtons onClose={onClose} pending={pending} disabled={!name} />
      </form>
    </DialogShell>
  );
}

function MovementDialog({ item, onClose, onSubmit, pending }: {
  item: StockItem; onClose: () => void;
  onSubmit: (v: { stockItemId: string; kind: "in" | "out" | "adjust"; quantity: number; referenceDoc?: string; note?: string }) => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<"in" | "out" | "adjust">("in");
  const [quantity, setQuantity] = useState<number>(1);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  return (
    <DialogShell title={`Bewegung: ${item.articleName}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ stockItemId: item.id, kind, quantity, referenceDoc: reference || undefined, note: note || undefined }); }} className="p-5 space-y-3">
        <div className="text-xs text-muted-fg">Aktueller Bestand: <strong className="text-fg">{Number(item.quantity)} {item.articleUnit}</strong></div>
        <FieldGroup columns={2}>
          <Field label="Typ">
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
              <option value="in">Zugang (Wareneingang)</option>
              <option value="out">Abgang (Verbrauch)</option>
              <option value="adjust">Korrektur (auf Wert setzen)</option>
            </select>
          </Field>
          <Field label="Menge">
            <Input type="number" step="0.001" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min={0.001} required />
          </Field>
        </FieldGroup>
        <Field label="Beleg-Referenz"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="z.B. RE-Lieferant 12345 oder Projekt P-2026-001" /></Field>
        <Field label="Notiz"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" /></Field>
        <FooterButtons onClose={onClose} pending={pending} disabled={quantity <= 0} />
      </form>
    </DialogShell>
  );
}

function AddStockDialog({ warehouseId, onClose, onSubmit, pending }: {
  warehouseId: string; onClose: () => void;
  onSubmit: (v: { warehouseId: string; articleId: string; minStock?: number; locationCode?: string }) => void;
  pending: boolean;
}) {
  const articles = trpc.articles.searchQuick.useQuery({ q: "x", limit: 20 });
  const [articleId, setArticleId] = useState("");
  const [minStock, setMinStock] = useState<number | "">("");
  const [locationCode, setLocationCode] = useState("");
  return (
    <DialogShell title="Artikel ins Lager aufnehmen" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ warehouseId, articleId, minStock: minStock === "" ? undefined : Number(minStock), locationCode: locationCode || undefined }); }} className="p-5 space-y-3">
        <Field label="Artikel" required>
          <select value={articleId} onChange={(e) => setArticleId(e.target.value)} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full" required>
            <option value="">— wählen —</option>
            {(articles.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
          </select>
        </Field>
        <FieldGroup columns={2}>
          <Field label="Mindestbestand"><Input type="number" step="0.001" value={minStock} onChange={(e) => setMinStock(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
          <Field label="Lagerplatz-Code"><Input value={locationCode} onChange={(e) => setLocationCode(e.target.value)} placeholder="z.B. A-1-3" /></Field>
        </FieldGroup>
        <p className="text-xs text-muted-fg">Anfangsbestand: 0. Trag den ersten Wareneingang über „Bewegung" → „Zugang" ein.</p>
        <FooterButtons onClose={onClose} pending={pending} disabled={!articleId} />
      </form>
    </DialogShell>
  );
}

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg"><X className="size-4" /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

function FooterButtons({ onClose, pending, disabled }: { onClose: () => void; pending: boolean; disabled?: boolean }) {
  return (
    <footer className="flex justify-end gap-2 pt-2 border-t border-border">
      <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Settings className="size-4" />} Speichern
      </Button>
    </footer>
  );
}

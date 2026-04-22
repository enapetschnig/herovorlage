"use client";
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, ScanText, Upload, X } from "lucide-react";
import { formatDate, formatMoney } from "@heatflow/utils";

type Media = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export function OcrReceiptClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ b64: string; name: string; mime: Media; preview?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const scan = trpc.flowai.ocrReceipt.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const pick = async (f: File) => {
    const MAX = 16 * 1024 * 1024;
    if (f.size > MAX) { toast.error("Max. 16 MB."); return; }
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
      toast.error("Nur JPEG/PNG/WebP oder PDF.");
      return;
    }
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(f);
    });
    const b64 = dataUrl.split(",")[1] ?? "";
    setFile({
      b64, name: f.name, mime: f.type as Media,
      preview: f.type.startsWith("image/") ? dataUrl : undefined,
    });
    scan.reset();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  };

  const result = scan.data;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Upload */}
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"} aspect-[3/4] relative overflow-hidden grid place-items-center`}
        >
          {file ? (
            <>
              {file.preview ? (
                <img src={file.preview} alt="Vorschau" className="absolute inset-0 w-full h-full object-contain bg-card" />
              ) : (
                <div className="text-center p-8">
                  <FileText className="size-16 text-muted-fg mx-auto mb-2" />
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-muted-fg">{file.mime}</div>
                </div>
              )}
              <button
                onClick={() => { setFile(null); scan.reset(); }}
                className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                aria-label="Entfernen"
              ><X className="size-4" /></button>
            </>
          ) : (
            <div className="text-center space-y-2 p-8">
              <Upload className="size-10 text-muted-fg mx-auto" />
              <div className="font-medium text-sm">Beleg hier ablegen</div>
              <div className="text-xs text-muted-fg">PDF, JPEG, PNG oder WebP — max. 16 MB</div>
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                <FileText className="size-4" /> Datei auswählen
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
              />
            </div>
          )}
        </div>

        <Button
          className="w-full" size="lg"
          disabled={!file || scan.isPending}
          onClick={() => file && scan.mutate({ file: file.b64, mediaType: file.mime })}
        >
          {scan.isPending ? <><Loader2 className="size-4 animate-spin" /> Claude liest den Beleg…</> : <><ScanText className="size-4" /> Beleg scannen</>}
        </Button>

        <p className="text-xs text-muted-fg text-center">
          Unterstützt DE/AT-Großhandel-Formate: Frauenthal, Holter, Pfeiffer, Würth, Viessmann, Vaillant, …
        </p>
      </div>

      {/* Result */}
      <div>
        {!result && !scan.isPending && (
          <Card className="h-full">
            <CardContent className="py-12 text-center text-muted-fg text-sm">
              Extrahierte Rechnungsdaten erscheinen hier.
            </CardContent>
          </Card>
        )}

        {scan.isPending && (
          <Card>
            <CardContent className="py-16 text-center text-muted-fg space-y-3">
              <Loader2 className="size-6 animate-spin mx-auto" />
              <div>Claude Vision liest den Beleg…</div>
            </CardContent>
          </Card>
        )}

        {result && <OcrResult result={result} />}
      </div>
    </div>
  );
}

function OcrResult({ result }: { result: NonNullable<ReturnType<typeof trpc.flowai.ocrReceipt.useMutation>["data"]> }) {
  return (
    <div className="space-y-4">
      {result._demo && <Badge tone="warning">Demo-Daten (ANTHROPIC_API_KEY fehlt)</Badge>}

      <ReceiptSaveCard result={result} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lieferant</span>
            <Badge tone={result.supplier.match_confidence === "high" ? "success" : result.supplier.match_confidence === "medium" ? "warning" : "neutral"}>
              Match: {result.supplier.match_confidence}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div className="font-semibold">{result.supplier.name}</div>
          {result.supplier.vat_id && <div className="text-xs text-muted-fg">UID: {result.supplier.vat_id}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rechnung</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-3">
          <Row label="Nummer" value={result.invoice.number} mono />
          <Row label="Datum" value={formatDate(result.invoice.date)} />
          {result.invoice.due_date && <Row label="Fällig" value={formatDate(result.invoice.due_date)} />}
          <Row label="Währung" value={result.invoice.currency} />
          <div className="col-span-2 border-t border-border pt-2 mt-1 space-y-1">
            <Row label="Netto" value={formatMoney(result.invoice.total_net, { currency: result.invoice.currency })} />
            <Row label="USt." value={formatMoney(result.invoice.total_vat, { currency: result.invoice.currency })} />
            <div className="flex justify-between text-base font-semibold pt-1 border-t border-border">
              <span>Brutto</span>
              <span className="tabular-nums">{formatMoney(result.invoice.total_gross, { currency: result.invoice.currency })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Positionen ({result.positions.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-fg uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Art.-Nr.</th>
                <th className="text-left px-3 py-2">Bezeichnung</th>
                <th className="text-right px-3 py-2">Menge</th>
                <th className="text-right px-3 py-2">EP</th>
                <th className="text-right px-3 py-2">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {result.positions.map((p, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{p.article_number ?? "—"}</td>
                  <td className="px-3 py-2">{p.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.quantity} {p.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.unit_price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(result.suggested_account_skr03 || result.suggested_account_skr04) && (
        <Card>
          <CardHeader><CardTitle>Buchungs-Vorschläge</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {result.suggested_account_skr03 && <Row label="SKR03" value={result.suggested_account_skr03} mono />}
            {result.suggested_account_skr04 && <Row label="SKR04" value={result.suggested_account_skr04} mono />}
          </CardContent>
        </Card>
      )}

      {result.matched_project_hints.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-sm">Projekt-Hinweise</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {result.matched_project_hints.map((h, i) => (<li key={i}>• {h}</li>))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-fg">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value || <span className="text-muted-fg italic">—</span>}</span>
    </div>
  );
}

function ReceiptSaveCard({ result }: { result: NonNullable<ReturnType<typeof trpc.flowai.ocrReceipt.useMutation>["data"]> }) {
  const [supplierId, setSupplierId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [done, setDone] = useState<{ articlesUpserted: number; positions: number } | null>(null);

  const suppliers = trpc.contacts.list.useQuery({ page: 1, pageSize: 100, sortBy: "name", sortDir: "asc", type: "supplier" });
  const projects = trpc.projects.list.useQuery({ page: 1, pageSize: 100, sortDir: "desc" });

  const save = trpc.flowai.saveOcrAsReceipt.useMutation({
    onSuccess: (r) => { setDone(r); toast.success(`Beleg gebucht — ${r.articlesUpserted} Artikel ergänzt/aktualisiert`); },
    onError: (e) => toast.error(e.message),
  });

  if (done) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="text-sm py-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-success flex-shrink-0" />
          <div>
            <div className="font-semibold">Beleg gebucht</div>
            <div className="text-muted-fg">
              {done.positions} Positionen verarbeitet, {done.articlesUpserted} Artikel im Stamm angelegt/aktualisiert.
              Logbuch-Eintrag wurde erstellt.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader><CardTitle className="text-sm">Als Eingangsrechnung buchen</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-fg block mb-1">Lieferant</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
              <option value="">— wählen —</option>
              {suppliers.data?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {(s.companyName ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim()) || s.customerNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-fg block mb-1">Projekt zuordnen (optional)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
              <option value="">— ohne Projekt —</option>
              {projects.data?.items.map((p) => (
                <option key={p.id} value={p.id}>{p.number} — {p.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-xs text-muted-fg">
            Artikel werden im Stamm angelegt/aktualisiert (EK-Preise), Logbuch-Eintrag wird geschrieben.
          </div>
          <Button
            size="sm"
            disabled={save.isPending || (!supplierId && !projectId)}
            onClick={() =>
              save.mutate({
                supplierContactId: supplierId || undefined,
                projectId: projectId || undefined,
                invoice: {
                  number: result.invoice.number,
                  date: result.invoice.date,
                  totalNet: result.invoice.total_net,
                  totalVat: result.invoice.total_vat,
                  totalGross: result.invoice.total_gross,
                },
                positions: result.positions.map((p) => ({
                  articleNumber: p.article_number,
                  description: p.description,
                  quantity: p.quantity,
                  unit: p.unit,
                  unitPrice: p.unit_price,
                  total: p.total,
                  vatPct: p.vat_pct,
                })),
              })
            }
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Buchen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field } from "@heatflow/ui";
import { decodeDatanormBytes, parseDatanorm, type DatanormArticle } from "@heatflow/integrations-datanorm";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { formatMoney } from "@heatflow/utils";

export function DatanormImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseDatanorm> | null>(null);
  const [supplierId, setSupplierId] = useState<string>("");
  const [result, setResult] = useState<{ created: number; updated: number; deleted: number } | null>(null);

  const suppliers = trpc.contacts.list.useQuery({
    page: 1, pageSize: 100, sortBy: "name", sortDir: "asc", type: "supplier",
  });
  const importArticles = trpc.articles.importDatanorm.useMutation({
    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.created + r.updated} Artikel importiert (${r.created} neu, ${r.updated} aktualisiert)`);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const parseFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = decodeDatanormBytes(bytes);
    const parsed = parseDatanorm(text);
    setFileName(file.name);
    setParseResult(parsed);
    setResult(null);
    if (parsed.articles.length === 0) {
      toast.error("Keine Artikel in der Datei gefunden. Ist das wirklich eine Datanorm-Datei?");
    } else {
      toast.success(`${parsed.articles.length} Artikel erkannt (${parsed.totalLines.toLocaleString()} Zeilen gelesen)`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>1. Datanorm-Datei auswählen</CardTitle></CardHeader>
        <CardContent>
          <label className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/20 transition-colors block">
            <FileUp className="size-8 text-muted-fg" />
            <span className="text-sm font-medium">Datanorm-Datei hier ablegen oder klicken</span>
            <span className="text-xs text-muted-fg">
              {fileName ? fileName : "Endung .001 / .txt / .dn · ASCII oder UTF-8 · max. 50 MB"}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".001,.002,.003,.txt,.dn,.asc"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
            />
          </label>
        </CardContent>
      </Card>

      {parseResult && parseResult.articles.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle>2. Lieferant wählen (optional)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Lieferant" hint="Wird auf alle importierten Artikel geschrieben.">
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
                  <option value="">— nicht zuordnen —</option>
                  {suppliers.data?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() || s.customerNumber || s.id}
                    </option>
                  ))}
                </select>
              </Field>
              {parseResult.meta?.supplier && (
                <div className="text-xs text-muted-fg">
                  Datei-Header nennt Lieferant: <strong className="text-fg">{parseResult.meta.supplier}</strong>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>3. Vorschau ({parseResult.articles.length} Artikel)</span>
                <div className="flex gap-2 text-xs">
                  <Badge tone="success">{parseResult.articles.filter((a) => a.kind === "new").length} neu</Badge>
                  <Badge>{parseResult.articles.filter((a) => a.kind === "change").length} ändern</Badge>
                  <Badge tone="danger">{parseResult.articles.filter((a) => a.kind === "delete").length} löschen</Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-fg">Nr.</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-fg">Bezeichnung</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-fg w-[50px]">Einh.</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-fg w-[100px]">Preis</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-fg w-[70px]">Art</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.articles.slice(0, 200).map((a, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{a.number}</td>
                        <td className="px-3 py-1.5 truncate max-w-[300px]">{a.shortText}</td>
                        <td className="px-3 py-1.5">{a.unit}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(a.priceEuro)}</td>
                        <td className="px-3 py-1.5">
                          {a.kind === "new" ? <Badge tone="success">neu</Badge> : a.kind === "delete" ? <Badge tone="danger">del</Badge> : <Badge>upd</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parseResult.articles.length > 200 && (
                  <div className="text-xs text-muted-fg text-center py-3 border-t border-border">
                    … +{parseResult.articles.length - 200} weitere Artikel (werden mit-importiert)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {parseResult.errors.length > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="text-xs text-muted-fg">
                <strong className="text-warning">{parseResult.errors.length}</strong> Zeilen nicht parsebar (werden übersprungen). Erste 5:
                <ul className="mt-1 space-y-0.5">
                  {parseResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>Zeile {e.line}: {e.reason}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>4. Import starten</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-fg">
                {parseResult.articles.length} Artikel werden in den Stamm übernommen. Duplikate werden basierend auf <strong>Artikelnummer</strong> aktualisiert.
              </div>
              <Button
                disabled={importArticles.isPending || parseResult.articles.length === 0}
                onClick={() =>
                  importArticles.mutate({
                    supplierId: supplierId || undefined,
                    articles: parseResult.articles.map((a) => ({
                      kind: a.kind,
                      number: a.number,
                      shortText: a.shortText || undefined,
                      longText: a.longText || undefined,
                      unit: a.unit,
                      priceKind: a.priceKind,
                      priceEuro: a.priceEuro,
                      ean: a.ean,
                      matchcode: a.matchcode,
                      manufacturer: a.manufacturer,
                      manufacturerNumber: a.manufacturerNumber,
                    })),
                  })
                }
              >
                {importArticles.isPending ? <><Loader2 className="size-4 animate-spin" /> Importiere…</> : <><CheckCircle2 className="size-4" /> Importieren</>}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> Import abgeschlossen</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><strong>{result.created}</strong> Artikel neu angelegt</div>
            <div><strong>{result.updated}</strong> bestehende aktualisiert (Preis, Text)</div>
            {result.deleted > 0 && <div><strong>{result.deleted}</strong> gelöscht (Datanorm-L-Record)</div>}
            <p className="text-xs text-muted-fg pt-2">Alle importierten Artikel tragen das Tag „is_imported=true" und können in der Artikel-Liste gefiltert werden.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

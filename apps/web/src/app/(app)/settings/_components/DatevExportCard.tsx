"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@heatflow/ui";
import { formatMoney } from "@heatflow/utils";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

export function DatevExportCard() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [sr, setSr] = useState<"SKR03" | "SKR04">("SKR03");

  const preview = trpc.documents.datevPreview.useQuery(
    { fromDate: from, toDate: to, sr },
    { enabled: !!from && !!to },
  );

  const url = `/api/datev/export?from=${from}&to=${to}&sr=${sr}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-primary" /> DATEV-Export (Modul M10)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-fg">
          Exportiert alle <strong>abgeschlossenen (locked) Rechnungen</strong> im gewählten Zeitraum
          als DATEV-Buchungsstapel-CSV. Format: <code className="font-mono text-xs">EXTF 510 Buchungsstapel v12</code>, Windows-1252-Encoding. Direkt importierbar im DATEV-Unternehmen-Online-Assistent deines Steuerberaters.
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Von (Belegdatum)"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Bis"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Kontenrahmen">
            <select value={sr} onChange={(e) => setSr(e.target.value as "SKR03" | "SKR04")} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
              <option value="SKR03">SKR03 (DE Industrie)</option>
              <option value="SKR04">SKR04 (DE Finanz)</option>
            </select>
          </Field>
        </div>

        {preview.isLoading && (
          <div className="text-sm text-muted-fg"><Loader2 className="size-4 animate-spin inline mr-2" /> Vorschau lädt…</div>
        )}
        {preview.data && (
          <div className="rounded border border-border bg-muted/30 p-3 text-sm">
            <div className="font-medium">
              {preview.data.documents} Rechnungen → {preview.data.bookings} Buchungssätze ·{" "}
              <span className="tabular-nums">{formatMoney(preview.data.totalGross)}</span> Brutto
            </div>
            <div className="text-xs text-muted-fg mt-1">
              Nur abgeschlossene Belege. Entwürfe/nicht-gelockte Rechnungen werden <strong>nicht</strong> exportiert.
              {preview.data.documents === 0 && " — Keine passenden Belege im Zeitraum gefunden."}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <a href={url}>
            <Button disabled={(preview.data?.documents ?? 0) === 0}>
              <Download className="size-4" /> CSV herunterladen
            </Button>
          </a>
        </div>

        <details className="text-xs text-muted-fg">
          <summary className="cursor-pointer">DATEV-Konten-Mapping (Default)</summary>
          <table className="w-full mt-2 border border-border rounded overflow-hidden">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1 text-left">USt</th>
                <th className="px-2 py-1 text-left">SKR03</th>
                <th className="px-2 py-1 text-left">SKR04</th>
                <th className="px-2 py-1 text-left">BU</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-border"><td className="px-2 py-1">20 %</td><td className="px-2 py-1">8400</td><td className="px-2 py-1">4400</td><td className="px-2 py-1">3</td></tr>
              <tr className="border-t border-border"><td className="px-2 py-1">19 %</td><td className="px-2 py-1">8400</td><td className="px-2 py-1">4400</td><td className="px-2 py-1">3</td></tr>
              <tr className="border-t border-border"><td className="px-2 py-1">10 %</td><td className="px-2 py-1">8300</td><td className="px-2 py-1">4300</td><td className="px-2 py-1">2</td></tr>
              <tr className="border-t border-border"><td className="px-2 py-1">7 %</td><td className="px-2 py-1">8300</td><td className="px-2 py-1">4300</td><td className="px-2 py-1">2</td></tr>
              <tr className="border-t border-border"><td className="px-2 py-1">0 %</td><td className="px-2 py-1">8200</td><td className="px-2 py-1">4200</td><td className="px-2 py-1">—</td></tr>
            </tbody>
          </table>
          <p className="mt-2">Pro Kontakt kann in den Stammdaten ein individuelles Debitor-Konto hinterlegt werden (überschreibt 10000 Default).</p>
        </details>
      </CardContent>
    </Card>
  );
}

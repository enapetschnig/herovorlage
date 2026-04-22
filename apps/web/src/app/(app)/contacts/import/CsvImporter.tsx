"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@heatflow/ui";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";

type Row = Record<string, string>;

/**
 * Column mapping: user sees detected CSV columns and picks which HeatFlow field
 * each maps to. Initial mapping is guessed from header aliases.
 */
const FIELD_LABELS: Record<string, string> = {
  companyName: "Firmenname",
  firstName: "Vorname",
  lastName: "Nachname",
  email: "E-Mail",
  phone: "Telefon",
  mobile: "Mobil",
  street: "Straße",
  zip: "PLZ",
  city: "Ort",
  country: "Land",
  vatId: "UID/UStId",
  iban: "IBAN",
  notes: "Notizen",
};

const ALIASES: Record<string, string[]> = {
  companyName: ["firma", "company", "company_name", "unternehmen", "firmenname"],
  firstName: ["vorname", "first_name", "firstname", "given_name"],
  lastName: ["nachname", "last_name", "lastname", "surname", "familyname"],
  email: ["email", "mail", "e-mail", "e_mail"],
  phone: ["telefon", "phone", "tel", "festnetz"],
  mobile: ["mobil", "mobile", "handy", "cell"],
  street: ["strasse", "straße", "street", "adresse", "address"],
  zip: ["plz", "postleitzahl", "zip", "postcode"],
  city: ["ort", "stadt", "city", "town"],
  country: ["land", "country", "country_code"],
  vatId: ["uid", "ustid", "vat_id", "vatid", "steuernr"],
  iban: ["iban", "bankkonto"],
  notes: ["notizen", "notes", "bemerkung", "kommentar", "memo"],
};

function parseCsv(text: string): Row[] {
  // Tiny CSV parser — handles quoted fields + \r\n.
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') quoted = true;
      else if (ch === "," || ch === ";" || ch === "\t") { cur.push(cell); cell = ""; }
      else if (ch === "\n") { cur.push(cell); rows.push(cur); cur = []; cell = ""; }
      else if (ch === "\r") { /* ignore */ }
      else { cell += ch; }
    }
  }
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
  if (rows.length === 0) return [];

  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const obj: Row = {};
      for (let i = 0; i < header.length; i++) {
        obj[header[i] ?? `col_${i}`] = (r[i] ?? "").trim();
      }
      return obj;
    });
}

function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of Object.keys(FIELD_LABELS)) {
    const aliases = [field.toLowerCase(), ...(ALIASES[field] ?? [])];
    const match = headers.find((h) => aliases.includes(h.toLowerCase().replace(/\s+/g, "_")));
    if (match) mapping[field] = match;
  }
  return mapping;
}

export function CsvImporter() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [type, setType] = useState<"customer" | "supplier">("customer");
  const [kind, setKind] = useState<"person" | "company">("person");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; failed: number; errors: { row: number; message: string }[] } | null>(null);

  const importBulk = trpc.contacts.importBulk.useMutation({
    onSuccess: (res) => {
      setResult(res);
      if (res.imported > 0) toast.success(`${res.imported} Kontakte importiert`);
      if (res.failed > 0) toast.warning(`${res.failed} Zeilen mit Fehlern`);
      router.refresh();
    },
    onError: (e) => { setError(e.message); toast.error(e.message); },
  });

  const preview = useMemo(() => rows.slice(0, 10), [rows]);
  const payload = useMemo(() => rows.map((r) => {
    const out: Row = { type, kind, country: "AT" };
    for (const [field, col] of Object.entries(mapping)) {
      if (col && r[col] !== undefined) out[field] = r[col];
    }
    return out;
  }), [rows, mapping, type, kind]);

  const onFile = async (file: File) => {
    setError(null); setResult(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) { setError("CSV leer oder unleserlich."); return; }
    const hdrs = Object.keys(parsed[0] ?? {});
    setHeaders(hdrs);
    setMapping(guessMapping(hdrs));
    setRows(parsed);
    toast.success(`${parsed.length} Zeilen gelesen, ${hdrs.length} Spalten`);
  };

  return (
    <div className="space-y-4">
      {/* 1. Upload */}
      <Card>
        <CardHeader><CardTitle>1. CSV-Datei auswählen</CardTitle></CardHeader>
        <CardContent>
          <label className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/20 transition-colors block">
            <FileUp className="size-8 text-muted-fg" />
            <span className="text-sm font-medium">CSV hier ablegen oder klicken</span>
            <span className="text-xs text-muted-fg">Trennzeichen: , ; oder Tab · UTF-8</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          {/* 2. Defaults */}
          <Card>
            <CardHeader><CardTitle>2. Standardwerte</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Field label="Typ">
                <select value={type} onChange={(e) => setType(e.target.value as "customer" | "supplier")} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
                  <option value="customer">Kunde</option>
                  <option value="supplier">Lieferant</option>
                </select>
              </Field>
              <Field label="Person / Firma">
                <select value={kind} onChange={(e) => setKind(e.target.value as "person" | "company")} className="h-9 px-3 rounded border border-input bg-bg text-sm w-full">
                  <option value="person">Person</option>
                  <option value="company">Firma</option>
                </select>
              </Field>
            </CardContent>
          </Card>

          {/* 3. Mapping */}
          <Card>
            <CardHeader><CardTitle>3. Spalten-Mapping</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <Field key={field} label={label}>
                    <select
                      value={mapping[field] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                      className="h-9 px-3 rounded border border-input bg-bg text-sm w-full"
                    >
                      <option value="">— nicht zuordnen —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 4. Preview */}
          <Card>
            <CardHeader><CardTitle>4. Vorschau ({rows.length} Zeilen, zeige erste 10)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    {Object.keys(FIELD_LABELS).filter((f) => mapping[f]).map((f) => (
                      <th key={f} className="text-left px-3 py-2 font-medium text-muted-fg">{FIELD_LABELS[f]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {Object.keys(FIELD_LABELS).filter((f) => mapping[f]).map((f) => (
                        <td key={f} className="px-3 py-2 truncate max-w-[200px]">{r[mapping[f] ?? ""] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* 5. Import */}
          <Card>
            <CardHeader><CardTitle>5. Import starten</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-fg">
                {rows.length} Kontakte werden als <strong className="text-fg">{type === "customer" ? "Kunden" : "Lieferanten"}</strong> ({kind === "person" ? "Personen" : "Firmen"}) angelegt.
              </div>
              <Button
                disabled={importBulk.isPending}
                onClick={() => importBulk.mutate({ rows: payload as unknown as never[] })}
              >
                {importBulk.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {rows.length} importieren
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle>Ergebnis</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" />
                <span><strong>{result.imported}</strong> erfolgreich</span>
              </div>
              {result.failed > 0 && (
                <div className="flex items-center gap-2">
                  <X className="size-4 text-danger" />
                  <span><strong>{result.failed}</strong> mit Fehlern</span>
                </div>
              )}
            </div>
            {result.errors.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted-fg cursor-pointer">Fehler anzeigen</summary>
                <ul className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e) => (
                    <li key={e.row} className="text-danger">Zeile {e.row}: {e.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

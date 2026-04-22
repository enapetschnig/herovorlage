/**
 * Datanorm-4-/5-Parser für Großhandels-Artikelstamm-Dateien.
 *
 * Datanorm ist ein Zeilen-basiertes, semikolon-separiertes ASCII-Format.
 * Hier implementiert: die A-Records (Artikel-Stammdaten) + V-Records (Kopfzeile)
 * aus Datanorm 4.0/5.0 — genug für den SHK-Artikelstamm-Import in HeatFlow.
 *
 * Jede Zeile beginnt mit einem Satzkennzeichen:
 *   V = Vorspann-Satz (Metadaten, optional)
 *   A = Artikel-Stammsatz (Primärdaten)
 *   B = Artikel-Staffelpreise (ignoriert in V1)
 *   T = Langtext-Satz (optional, mehrere pro Artikel)
 *   G = Rabattgruppen (ignoriert)
 *   P = Preissatz (verknüpft mit A)
 *   Z = Zuschläge (ignoriert)
 *
 * A-Record Layout (Minimum, Felder mit ; getrennt):
 *   [0] "A"
 *   [1] Satzkennzeichen (N = Neu, A = Änderung, L = Löschen)
 *   [2] Artikelnummer (max. 40 Zeichen)
 *   [3] Textkennzeichen (0 = 2 Zeilen à 40 Zeichen, 1 = Langtext folgt)
 *   [4] Kurztext Zeile 1 (40 Zeichen)
 *   [5] Kurztext Zeile 2 (40 Zeichen)
 *   [6] Dimension/Einheit (z.B. "ST", "M", "KG")
 *   [7] Preiskennzeichen (PKZ: 1 = Listenpreis, 2 = Einkaufspreis, 3 = Nettopreis)
 *   [8] Preis-Einheit (PE: 1, 10, 100, 1000 — pro wieviel Einheiten ist der Preis)
 *   [9] Preis in Cent (Integer, keine Dezimalstellen)
 *   [10] Rabattgruppe
 *   [11] Warengruppe
 *   [12] Langtextschlüssel
 *   [13] Matchcode
 *   [14] Alternativartikel
 *   [15] Folgeartikel
 *   [16] Katalog-Artikelnummer (EAN bei manchen Herstellern)
 */

export type DatanormArticle = {
  kind: "new" | "change" | "delete";
  number: string;
  shortText: string;              // Kurztext (zusammengesetzt aus Zeile 1 + 2)
  longText?: string;              // aus T-Records
  unit: string;                   // Dimension/Einheit
  priceKind: "list" | "purchase" | "net";
  pricePer: number;               // Preis pro N Einheiten
  priceEuro: number;              // In EUR (umgerechnet aus Cent)
  ean?: string;
  matchcode?: string;
  warehouseGroup?: string;
  rabattGroup?: string;
  manufacturer?: string;
  manufacturerNumber?: string;
};

export type DatanormParseResult = {
  articles: DatanormArticle[];
  totalLines: number;
  skippedLines: number;
  meta?: { supplier?: string; date?: string; currency?: string };
  errors: Array<{ line: number; reason: string }>;
};

const PRICE_KIND_MAP: Record<string, DatanormArticle["priceKind"]> = {
  "1": "list",
  "2": "purchase",
  "3": "net",
  "4": "net",
};

/**
 * Parses a full Datanorm file. Accepts both native CP850/ISO-8859-1 decoded
 * text and modern UTF-8 files. The caller decodes the bytes first (see
 * `decodeBytes` below for a helper).
 */
export function parseDatanorm(text: string): DatanormParseResult {
  const articles: DatanormArticle[] = [];
  const errors: Array<{ line: number; reason: string }> = [];
  const longTexts = new Map<string, string[]>(); // articleNumber -> lines
  let skipped = 0;
  let meta: DatanormParseResult["meta"] = {};

  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) { skipped++; continue; }

    const cols = line.split(";");
    const kind = cols[0]?.toUpperCase();

    try {
      if (kind === "V") {
        // V;Version;WKZ;Druck;...;Lieferant;
        meta = {
          supplier: cols[5]?.trim() || cols[4]?.trim() || "",
          currency: cols[2]?.trim() || "EUR",
          date: cols[3]?.trim() || "",
        };
      } else if (kind === "A") {
        const art = parseARecord(cols);
        if (art) articles.push(art);
        else { errors.push({ line: i + 1, reason: "A-Record konnte nicht geparst werden" }); skipped++; }
      } else if (kind === "T") {
        // T;Artikelnummer;Zeile;Text
        const num = cols[2]?.trim();
        const text = cols[4]?.trim() ?? "";
        if (num && text) {
          const list = longTexts.get(num) ?? [];
          list.push(text);
          longTexts.set(num, list);
        }
      } else {
        // P, B, G, Z — not supported in V1
        skipped++;
      }
    } catch (e) {
      errors.push({ line: i + 1, reason: e instanceof Error ? e.message : String(e) });
      skipped++;
    }
  }

  // Stitch long texts
  for (const a of articles) {
    const lt = longTexts.get(a.number);
    if (lt) a.longText = lt.join("\n");
  }

  return {
    articles,
    totalLines: lines.length,
    skippedLines: skipped,
    meta,
    errors,
  };
}

function parseARecord(cols: string[]): DatanormArticle | null {
  if (cols.length < 10) return null;
  const kindKey = cols[1]?.trim().toUpperCase() ?? "N";
  const kind: DatanormArticle["kind"] = kindKey === "L" ? "delete" : kindKey === "A" ? "change" : "new";

  const number = cols[2]?.trim();
  if (!number) return null;

  const shortText = [cols[4], cols[5]].map((s) => s?.trim() ?? "").filter(Boolean).join(" ");
  if (!shortText && kind !== "delete") return null;

  const unit = cols[6]?.trim() || "Stk";
  const priceKind = PRICE_KIND_MAP[cols[7]?.trim() ?? "1"] ?? "list";
  const pricePer = parseInt(cols[8]?.trim() ?? "1", 10) || 1;
  const priceCents = parseInt(cols[9]?.trim() ?? "0", 10) || 0;
  const priceEuro = (priceCents / 100) / pricePer;

  return {
    kind,
    number,
    shortText: mapUnit(shortText),
    unit: mapUnit(unit),
    priceKind,
    pricePer,
    priceEuro: Math.round(priceEuro * 10000) / 10000,
    rabattGroup: cols[10]?.trim() || undefined,
    warehouseGroup: cols[11]?.trim() || undefined,
    matchcode: cols[13]?.trim() || undefined,
    ean: cols[16]?.trim() || undefined,
  };
}

/** Datanorm-units are often 2-letter codes. Map common ones to HeatFlow-friendly. */
function mapUnit(u: string): string {
  const m: Record<string, string> = {
    ST: "Stk", STK: "Stk", STÜCK: "Stk", PC: "Stk",
    M: "m", MT: "m", MR: "m",
    M2: "m2", M3: "m3",
    KG: "kg", G: "g",
    L: "l", LT: "l",
    H: "h", STD: "h",
    PAAR: "Paar", PA: "Paar",
    PAUSCHAL: "Pausch", PAUSCH: "Pausch",
  };
  const up = u.trim().toUpperCase();
  return m[up] ?? u;
}

/**
 * Decodes raw bytes with legacy codepages if the file isn't UTF-8.
 * Datanorm files are traditionally CP437/CP850; modern exports are often UTF-8.
 */
export function decodeDatanormBytes(bytes: Uint8Array): string {
  // Try UTF-8 first (handles BOM)
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // If we see replacement chars and suspicious CP850-ish bytes, fall back to windows-1252
  if (utf8.includes("�")) {
    return new TextDecoder("windows-1252", { fatal: false }).decode(bytes);
  }
  return utf8;
}

/**
 * DATEV-CSV-Export im Format „DATEV Unternehmen Online — Buchungsstapel".
 *
 * Implementierung nach DATEV-Spezifikation v12.0 (Beleg-Import / Buchungsstapel):
 * - Zeichensatz: ISO-8859-1 (wir geben Windows-CP1252 aus — gängige Variante, die Kanzlei-Import-Assistenten akzeptieren)
 * - Trennzeichen: Semikolon
 * - Dezimaltrennzeichen: Komma
 * - Datumsformat Belegdatum: TTMM (4-stellig, ohne Jahr — DATEV liest Wirtschaftsjahr aus Kopfzeile)
 * - Kopfzeile: 1 Zeile mit Meta-Feldern (Version 510, Mandant, Beraternummer, WJ-Beginn, Konto-Länge, …)
 * - Datenzeilen: 116 Felder pro Buchung (nur erste ~10 relevant, Rest leer)
 */

export type DatevExportOpts = {
  consultantNumber?: number; // Beraternummer (bleibt leer wenn unbekannt)
  clientNumber?: number;     // Mandant
  fiscalYearStart: string;   // YYYYMMDD
  accountLength?: number;    // Konten-Länge (4 oder 5 üblich)
  recordedFrom: string;      // YYYYMMDD — erfasst von
  recordedUntil: string;     // YYYYMMDD — erfasst bis
  clientName: string;        // Firmenname für Header
};

export type DatevBooking = {
  amount: number;            // Brutto
  debitCreditCode: "S" | "H"; // Soll (S) / Haben (H)
  currency?: "EUR" | "CHF";
  account: string;           // Sachkonto (z.B. 1400 Debitoren oder 8400 Erlöse 20%)
  contraAccount: string;     // Gegenkonto (z.B. 10001 = Debitor Kunde 1)
  buKey?: string;            // BU-Schlüssel (USt-Satz — "9" = 19%, siehe Liste)
  bookingDate: string;       // YYYYMMDD
  docField1?: string;        // Belegfeld 1 (z.B. RE-Nummer)
  docField2?: string;        // Belegfeld 2 (z.B. Fälligkeitsdatum TTMMJJJJ)
  text: string;              // Buchungstext (max. 60 Zeichen)
  costCenter1?: string;      // KOST 1
  costCenter2?: string;      // KOST 2
};

const HEADER_FIELDS = [
  "EXTF",                    // 1. Magic
  "510",                     // 2. Versionsnummer
  "21",                      // 3. Datenkategorie (Buchungsstapel)
  "Buchungsstapel",          // 4. Formatname
  "12",                      // 5. Formatversion
  () => formatDateTimeCompact(new Date()), // 6. Erzeugt am
  "",                        // 7. Importiert (leer)
  "RE",                      // 8. Herkunft (RE = Rechnungsprogramm)
  "HeatFlow",                // 9. Exportiert von
  "",                        // 10. Importiert von (leer)
];

export function renderDatevCsv(bookings: DatevBooking[], opts: DatevExportOpts): Uint8Array {
  const header = [
    ...HEADER_FIELDS.map((v) => (typeof v === "function" ? v() : v)),
    opts.consultantNumber ?? "",        // 11. Beraternummer
    opts.clientNumber ?? "",            // 12. Mandantennummer
    opts.fiscalYearStart,               // 13. WJ-Beginn (YYYYMMDD)
    opts.accountLength ?? 4,            // 14. Sachkontenlänge
    opts.recordedFrom,                  // 15. Datum von
    opts.recordedUntil,                 // 16. Datum bis
    "",                                 // 17. Bezeichnung
    "",                                 // 18. Diktatkürzel
    "1",                                // 19. Buchungstyp (1 = Finanzbuchführung)
    "0",                                // 20. Rechnungslegungszweck (0 = Standard)
    "0",                                // 21. Festschreibung
    "EUR",                              // 22. WKZ
    "",                                 // 23. reserviert
    "",                                 // 24. Derivatskennzeichen
    "",                                 // 25. reserviert
    "",                                 // 26. reserviert
    "",                                 // 27. Sachkontenrahmen
    "",                                 // 28. ID der Branche
    "",                                 // 29. reserviert
    "",                                 // 30. reserviert
    "",                                 // 31. Anwendungs-Info
  ];

  const columnHeaders = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs", "Basis-Umsatz", "WKZ Basis-Umsatz",
    "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2",
    "Skonto", "Buchungstext", "Postenschlüssel-Erweiterung", "Beleg-Info-Art 1", "Beleg-Info-Inhalt 1",
    "Beleg-Info-Art 2", "Beleg-Info-Inhalt 2", "KOST1 - Kostenstelle", "KOST2 - Kostenstelle", "KOST-Menge",
    "EU-Land u. UStID", "EU-Steuersatz", "Abw. Versteuerungsart", "Sachverhalt", "Funktionsergänzung",
    "BU 49 Hauptfunktionstyp", "BU 49 Hauptfunktionsnummer", "BU 49 Funktionsergänzung",
    "Zusatzinformation - Art 1", "Zusatzinformation - Inhalt 1", // 32
    // To keep the header short in this V1, we emit the first 32 column names + the rest are empty strings
    ...Array(116 - 32).fill(""),
  ];

  const rows: string[] = [];
  rows.push(csvLine(header));
  rows.push(csvLine(columnHeaders));

  for (const b of bookings) {
    const row = [
      formatAmount(b.amount),              // 1. Umsatz
      b.debitCreditCode,                    // 2. S/H
      b.currency ?? "EUR",                  // 3. WKZ
      "",                                   // 4. Kurs
      "",                                   // 5. Basis-Umsatz
      "",                                   // 6. WKZ Basis-Umsatz
      b.account,                            // 7. Konto
      b.contraAccount,                      // 8. Gegenkonto
      b.buKey ?? "",                        // 9. BU-Schlüssel
      formatBookingDate(b.bookingDate),     // 10. Belegdatum TTMM
      truncate(b.docField1 ?? "", 36),      // 11. Belegfeld 1
      truncate(b.docField2 ?? "", 12),      // 12. Belegfeld 2
      "",                                   // 13. Skonto
      truncate(b.text, 60),                 // 14. Buchungstext
      "",                                   // 15. Postenschlüssel
      "", "", "", "",                       // 16-19 Beleg-Info 1+2
      b.costCenter1 ?? "",                  // 20. KOST1
      b.costCenter2 ?? "",                  // 21. KOST2
      "",                                   // 22. KOST-Menge
      ...Array(116 - 22).fill(""),          // pad to 116 columns
    ];
    rows.push(csvLine(row));
  }

  const csv = rows.join("\r\n") + "\r\n";
  return encodeWindows1252(csv);
}

// -----------------------------------------------------------------------------
// Booking-generators from HeatFlow documents
// -----------------------------------------------------------------------------

export type HeatflowDocumentForDatev = {
  number: string;
  documentDate: string;       // YYYY-MM-DD
  dueDate?: string | null;
  type: string;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  contact: {
    debitorAccount?: string | null;
    companyName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
  positions: Array<{ vatPct: number; totalNet: number; description: string }>;
};

/**
 * Converts a HeatFlow invoice into one DATEV booking per VAT rate (split booking).
 * Basic SKR03 mapping: Debitor 10xxx → Erlöse 8400 (19%) / 8300 (7%) / 8200 (0%).
 */
export function invoiceToBookings(doc: HeatflowDocumentForDatev, opts: { defaultDebitor?: string; sr: "SKR03" | "SKR04" } = { sr: "SKR03" }): DatevBooking[] {
  const debitor = doc.contact.debitorAccount ?? opts.defaultDebitor ?? "10000";
  const bookingDate = (doc.documentDate ?? "").replace(/-/g, "");
  const contactName = (doc.contact.companyName ?? `${doc.contact.firstName ?? ""} ${doc.contact.lastName ?? ""}`.trim()) || "Kunde";
  const text = `RE ${doc.number} ${contactName}`.slice(0, 60);

  // VAT-rate buckets
  const buckets = new Map<number, number>();
  for (const p of doc.positions) {
    buckets.set(p.vatPct, (buckets.get(p.vatPct) ?? 0) + p.totalNet);
  }

  const accountFor = (vatPct: number): { account: string; buKey: string } => {
    const acc = opts.sr === "SKR04" ? skr04(vatPct) : skr03(vatPct);
    return acc;
  };

  const out: DatevBooking[] = [];
  // One booking per VAT rate
  for (const [vatPct, netSum] of buckets) {
    const { account, buKey } = accountFor(vatPct);
    const grossForBucket = netSum * (1 + vatPct / 100);
    out.push({
      amount: Math.round(grossForBucket * 100) / 100,
      debitCreditCode: "S",
      account: debitor,
      contraAccount: account,
      buKey,
      bookingDate,
      docField1: doc.number,
      docField2: doc.dueDate ? doc.dueDate.replace(/-/g, "").slice(2) + doc.dueDate.split("-")[0] : "",
      text,
    });
  }
  return out;
}

function skr03(vatPct: number): { account: string; buKey: string } {
  if (vatPct === 20) return { account: "8400", buKey: "3" };   // Erlöse 20% USt (DATEV BU 3 für 19% in DE — AT mapping siehe Hinweis unten)
  if (vatPct === 19) return { account: "8400", buKey: "3" };   // Erlöse 19% USt
  if (vatPct === 10) return { account: "8300", buKey: "2" };   // Erlöse 10%
  if (vatPct === 7)  return { account: "8300", buKey: "2" };   // Erlöse 7%
  if (vatPct === 0)  return { account: "8200", buKey: "" };    // steuerfrei
  return { account: "8400", buKey: "3" };
}

function skr04(vatPct: number): { account: string; buKey: string } {
  if (vatPct === 20) return { account: "4400", buKey: "3" };
  if (vatPct === 19) return { account: "4400", buKey: "3" };
  if (vatPct === 10) return { account: "4300", buKey: "2" };
  if (vatPct === 7)  return { account: "4300", buKey: "2" };
  if (vatPct === 0)  return { account: "4200", buKey: "" };
  return { account: "4400", buKey: "3" };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function csvLine(cells: Array<string | number>): string {
  return cells.map((c) => quote(String(c))).join(";");
}

function quote(v: string): string {
  if (v === "") return "";
  if (/[;"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function formatAmount(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function formatBookingDate(yyyymmdd: string): string {
  // DATEV Belegdatum = TTMM (4 chars). Yes, really — DATEV infers year from header.
  const d = yyyymmdd.replace(/-/g, "");
  if (d.length < 8) return "";
  return d.slice(6, 8) + d.slice(4, 6);
}

function formatDateTimeCompact(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds()) +
    "000" // milliseconds (DATEV wants 17 chars YYYYMMDDHHMMSSFFF)
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** ISO-8859-1 / Windows-1252 encoder. Pure JS — no Buffer dependency for cross-runtime use. */
function encodeWindows1252(text: string): Uint8Array {
  // Windows-1252 is mostly identical to Latin-1; for characters beyond 0xFF we lose data.
  // HeatFlow data is German, so all € / ä / ö / ü / ß / é / à fit into CP1252.
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) out[i] = code;
    else if (code === 0x20AC) out[i] = 0x80; // €
    else if (code < 0x100) out[i] = code;
    else out[i] = 0x3F; // ? for unsupported chars
  }
  return out;
}

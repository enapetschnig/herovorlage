import { Briefcase, FileText, Settings, Sparkles, Wrench, Zap } from "lucide-react";

export type Article = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  tags: string[];
  body: string;
};

export const CATEGORIES = [
  { name: "Erste Schritte", icon: Zap },
  { name: "Kontakte & Projekte", icon: Briefcase },
  { name: "Dokumente & Rechnungen", icon: FileText },
  { name: "FlowAI", icon: Sparkles },
  { name: "Wartung & Anlagen", icon: Wrench },
  { name: "Einstellungen & Module", icon: Settings },
];

export const ARTICLES: Article[] = [
  {
    slug: "erster-tenant",
    title: "Tenant anlegen und Demo-Modus testen",
    category: "Erste Schritte",
    summary: "In 5 Minuten zum ersten Projekt — Schritt für Schritt durch das Onboarding.",
    tags: ["onboarding", "tenant", "signup"],
    body: `1. Auf /signup gehen und Firmen-Stammdaten ausfüllen.
2. Land wählen (AT, DE oder CH) — bestimmt Sprache, Währung und Konten-Mapping.
3. Admin-Account anlegen (E-Mail + Passwort, mindestens 8 Zeichen).
4. Module auswählen — empfohlen für WP-Betriebe: Wartung, FlowAI, Förderung.
5. „Konto erstellen" klicken — wirst direkt eingeloggt.

Standardmäßig sind alle Core-Funktionen aktiv (Kontakte, Projekte, Dokumente, Zeit, …). Module kannst du jederzeit unter /settings dazubuchen.`,
  },
  {
    slug: "kontakt-anlegen",
    title: "Neuen Kontakt anlegen",
    category: "Kontakte & Projekte",
    summary: "Person oder Firma mit allen 6 Tabs (Kontakt, Adresse, Konditionen, Bank, ZUGFeRD, Notizen).",
    tags: ["kontakte", "kunde", "lieferant"],
    body: `Über /contacts → „Neuer Kontakt" oder direkt im Projekt-Anlegen-Form über die Inline-Combobox „+ Neu".

Pflichtfelder: Typ (Kunde/Lieferant/Partner), Person/Firma + Name. Alles andere ist optional.
Tipp: Bei Lieferanten den Kreditor-Account hinterlegen, damit DATEV-Export sauber zuordnet.`,
  },
  {
    slug: "csv-import-kontakte",
    title: "Kontakte aus HERO/Streit/Excel importieren",
    category: "Kontakte & Projekte",
    summary: "CSV-Datei hochladen, Spalten-Mapping erkennen lassen, in einem Schritt 200+ Kontakte importieren.",
    tags: ["csv", "import", "migration", "hero"],
    body: `1. /contacts → „CSV importieren" oben rechts
2. CSV-Datei droppen — egal ob Komma, Semikolon oder Tab als Trennzeichen
3. Spalten werden auto-erkannt (Firma, Vorname, Email, Tel, Straße, …) — manuell überschreibbar
4. Vorschau zeigt erste 10 Zeilen → „Importieren"

Pro Zeile wird eine Transaktion ausgeführt — schlechte Datensätze blocken den Rest nicht. Fehler-Report inklusive.`,
  },
  {
    slug: "angebot-aus-foto",
    title: "Foto → Angebot mit Claude Vision",
    category: "FlowAI",
    summary: "Heizungsraum-Foto hochladen, KI analysiert Bestand und schlägt Wärmepumpe + Hydraulik vor.",
    tags: ["flowai", "foto", "claude", "vision", "angebot"],
    body: `1. Sidebar → FlowAI → „Foto → Angebot"
2. Foto vom Heizungsraum hochladen (max 8 MB, JPEG/PNG/WebP)
3. „Analysieren" — Claude Vision liefert in 5–10 Sek:
   - Bestandsanlage (Marke, Modell, Baujahr, kW-Leistung)
   - 3 WP-Empfehlungen (mit Begründung)
   - Hydraulik-Anpassungen (Pufferspeicher-Größe, Heizstab, Mischer)
   - Offene Klärungspunkte
4. „Angebot erstellen" → Dokumenten-Editor mit prefilled Positionen, du wählst nur noch den Kunden`,
  },
  {
    slug: "mail-zu-projekt",
    title: "Anfrage-Mail in Projekt umwandeln",
    category: "FlowAI",
    summary: "Kunden-Mail einfügen, Kontakt + Projekt + Aufgaben werden in einem Klick angelegt.",
    tags: ["flowai", "mail", "projekt"],
    body: `Sidebar → FlowAI → „Mail → Projekt"

Mail aus deinem Postfach kopieren (mit Von:/Betreff:/Body) und einfügen. Claude extrahiert:
- Kontaktdaten (Name, E-Mail, Telefon, Adresse)
- Projekt-Umfang + Dringlichkeit
- Vorgeschlagene Aktionen (Rückruf, Vor-Ort-Termin)

„Kontakt + Projekt anlegen" macht in einer Transaktion: neuer Kontakt mit Auto-Kundennummer + neues Projekt mit Status „Lead".`,
  },
  {
    slug: "ocr-beleg",
    title: "Eingangsrechnung scannen mit OCR",
    category: "FlowAI",
    summary: "Lieferanten-PDF hochladen, Positionen + DATEV-Konto werden automatisch erkannt.",
    tags: ["flowai", "ocr", "rechnung", "datev"],
    body: `Sidebar → FlowAI → „OCR Lieferantenrechnung"

PDF oder Bild der Rechnung droppen. Claude Vision extrahiert:
- Lieferant (Match-Confidence-Indikator)
- Rechnungsnummer + Datum + Fälligkeit
- Positionen mit Art.-Nr., Menge, EP, Summe
- SKR03/04-Buchungs-Vorschlag
- Projekt-Hinweise (matched über Position-Inhalt)

„Buchen" ergänzt die Artikel im Stamm (mit aktuellem EK) und schreibt einen Logbuch-Eintrag.`,
  },
  {
    slug: "wartung-anlegen",
    title: "Wartungsvertrag mit Auto-Termin-Rolling",
    category: "Wartung & Anlagen",
    summary: "Vertrag pro Kunde anlegen, Folgetermine werden nach jeder Wartung automatisch erzeugt.",
    tags: ["wartung", "anlage", "vitocal"],
    body: `1. Auf Kontakt-Detail → Anlagen-Card → „+ Anlage" für Wärmepumpe, PV, Pufferspeicher
2. /maintenance → Vertrag pro Kunde + Anlage + Intervall (z.B. 12 Monate) + Preis
3. Erste Visit wird automatisch geplant

Beim Abschließen einer Wartung (8-Punkt-Checkliste — Kältekreis, Verdampfer, Sole, Sicherheitsventile, Elektrik, Fehlerspeicher, Druckprüfung, Unterschrift):
- Vertrag rollt next_due_date um Intervall-Monate weiter
- Folgetermin wird automatisch in den Kalender eingetragen
- Logbuch-Eintrag`,
  },
  {
    slug: "rechnung-versenden",
    title: "Rechnung mit ZUGFeRD per E-Mail versenden",
    category: "Dokumente & Rechnungen",
    summary: "PDF + XRechnung-XML in einem Schritt erzeugen und an den Kunden mailen.",
    tags: ["rechnung", "pdf", "zugferd", "xrechnung"],
    body: `Auf jeder Dokument-Detail-Seite hast du oben drei Buttons:
- **PDF** öffnet das fertig gerenderte A4-PDF
- **XRechnung** lädt die EN 16931 / pain.008-XML herunter (für B2G in DE/AT)
- **Versenden** öffnet den E-Mail-Dialog: Empfänger vorbelegt aus Kontakt, Mustache-Templates für Subject + Body, optional XML zusätzlich anhängen

Nach Versand wird der Status auf „sent" gesetzt und ein Logbuch-Event geschrieben.`,
  },
  {
    slug: "datev-export",
    title: "DATEV-Export für den Steuerberater",
    category: "Dokumente & Rechnungen",
    summary: "Quartals-Rechnungen als DATEV-Buchungsstapel-CSV exportieren.",
    tags: ["datev", "steuer", "export", "skr03"],
    body: `/settings → DATEV-Export-Card

Zeitraum wählen (Quartal/Jahr), Kontenrahmen (SKR03 für Industrie, SKR04 für Finanz). Vorschau zeigt Anzahl Rechnungen + Brutto-Summe.

Wichtig: Es werden nur **abgeschlossene (locked) Rechnungen** exportiert — Entwürfe bleiben außen vor. Format: EXTF;510;21;Buchungsstapel;12;… mit Windows-1252-Encoding, direkt importierbar in DATEV Unternehmen Online.`,
  },
  {
    slug: "modul-aktivieren",
    title: "Modul nachträglich aktivieren",
    category: "Einstellungen & Module",
    summary: "Wartung, Förderung, Plantafel & Co jederzeit dazubuchen.",
    tags: ["module", "feature", "settings"],
    body: `/settings → Module-Card zeigt alle aktiven Module. Inaktive Module sind aus der Sidebar ausgeblendet.

Aktivieren: Aktuell über Support-Ticket (DB-Eintrag in tenant_features). Self-Service-Aktivierung via /settings/billing kommt mit Stripe-Integration in Phase 7.

Hinweis: Im Demo-Modus sind alle Module kostenlos. Erst beim Upgrade auf Produktiv-Modus zählen Module zur monatlichen Abrechnung.`,
  },
];

import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { ArrowRight, Check, Flame } from "lucide-react";

const CORE = {
  name: "HeatFlow Core",
  pricePerUser: 19,
  features: [
    "Kontakte + Projekte (CRM)",
    "Dokumente: Angebot → AB → Rechnung mit Tiptap-Editor",
    "Eigene Artikel + Leistungen",
    "Zeiterfassung mit Quick-Timer",
    "ZUGFeRD/XRechnung E-Rechnung (DE-Pflicht ab 2025)",
    "Mobile-App (Capacitor iOS + Android)",
    "Kundenportal (Basis)",
  ],
};

type Module = { id: string; name: string; price: string; pricing: "fix" | "per_user"; description: string; highlight?: boolean };

const MODULES: Module[] = [
  { id: "M1", name: "Datanorm-Import", price: "9", pricing: "fix", description: "Großhandels-Artikelstamm 1-Klick-Import (Frauenthal, Holter, Pfeiffer …)" },
  { id: "M2", name: "IDS Connect", price: "19", pricing: "fix", description: "Live-Bestellung + Verfügbarkeit beim Großhandel" },
  { id: "M3", name: "Wartungsverträge & Anlagen", price: "15", pricing: "fix", description: "Auto-Termin-Rolling pro Vertrag, 8-Punkt-Checkliste, Anlagenstamm pro Kunde — kritisch für WP-Betriebe" },
  { id: "M4", name: "Plantafel / Einsatzplanung", price: "12", pricing: "per_user", description: "Drag&Drop-Planung von Aufgaben + Wartungsterminen über Mitarbeiter und Tage" },
  { id: "M5", name: "Soll/Ist-Kalkulation", price: "10", pricing: "fix", description: "Live-Auswertung pro Projekt: Stunden, Material, Umsatz, Marge" },
  { id: "M6", name: "Lagerverwaltung", price: "15", pricing: "fix", description: "Lagerorte, Bestände, Bewegungen, Mindestbestand-Warnung" },
  { id: "M7", name: "Förderungsmanagement", price: "19", pricing: "fix", description: "BAFA, KfW, Raus-aus-Öl-Bonus mit Status-Tracking — für jede WP-Installation Geld holen", highlight: true },
  { id: "M8", name: "Heizlast-Anbindung", price: "9", pricing: "fix", description: "XML-Import aus Viessmann ViGuide, Vaillant ProE, Buderus, Hottgenroth" },
  { id: "M9", name: "Hersteller-APIs", price: "19", pricing: "fix", description: "Live-Anlagen-Status + Fehler-Codes von Viessmann, Vaillant, Bosch, Stiebel, NIBE" },
  { id: "M10", name: "DATEV / RZL / BMD Export", price: "15", pricing: "fix", description: "Buchungsstapel-CSV für den Steuerberater, SKR03/04 mit BU-Schlüssel" },
  { id: "M11", name: "SEPA & Mahnwesen", price: "12", pricing: "fix", description: "3-stufiges Mahnwesen mit PDF-Anhang + SEPA-Lastschrift-XML (pain.008.001.08)" },
  { id: "M12", name: "FlowAI", price: "29", pricing: "per_user", description: "Foto→Angebot, Mail→Projekt, OCR-Beleg, Sprache→Projekt, Assistenz-Panel — kein anderer Wettbewerber im DACH-Raum 2026", highlight: true },
  { id: "M13", name: "Checklisten", price: "9", pricing: "fix", description: "Wiederverwendbare Vorlagen für Vor-Ort, Abnahme, Sicherheit. Pflicht-Items mit Validierung." },
  { id: "M14", name: "Kanban + Projekt-Chat", price: "9", pricing: "fix", description: "Drag&Drop-Pipeline + interner Chat pro Projekt für Teams ab 3+" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-md bg-primary text-primary-fg grid place-items-center"><Flame className="size-4" /></div>
            HeatFlow
          </Link>
          <Link href="/signup"><Button size="sm">Kostenlos testen</Button></Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Transparent. Modular. Fair.</h1>
        <p className="text-muted-fg mt-4 max-w-2xl mx-auto">
          Du startest mit dem Core und buchst nur Module dazu, die du wirklich brauchst.
          Keine versteckten Setup-Kosten. Monatlich kündbar.
        </p>
      </section>

      {/* Core */}
      <section className="max-w-3xl mx-auto px-6 mb-16">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-2xl">{CORE.name}</div>
                <div className="text-sm text-muted-fg font-normal">Pflicht-Basis · alles andere baut darauf auf</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">€{CORE.pricePerUser}</div>
                <div className="text-xs text-muted-fg">pro User / Monat</div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {CORE.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="size-4 text-success flex-shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-center">
              <Link href="/signup"><Button size="lg"><ArrowRight className="size-4" /> Mit Core starten</Button></Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Modules */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-semibold text-center mb-2">Module dazubuchen</h2>
        <p className="text-sm text-muted-fg text-center mb-10">Direkt im Onboarding wählen oder später jederzeit aktivieren.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((m) => (
            <Card key={m.id} className={m.highlight ? "border-accent/40 bg-accent/5" : ""}>
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div>
                    <div className="text-xs text-muted-fg font-mono">{m.id}</div>
                    <div className="font-semibold">{m.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold">€{m.price}</div>
                    <div className="text-[10px] text-muted-fg">
                      {m.pricing === "per_user" ? "pro User/Monat" : "pro Monat"}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-fg leading-relaxed mt-2">{m.description}</p>
                {m.highlight && (
                  <Badge tone="accent" className="mt-3">Empfohlen</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold mb-2">Beispiel: 5-Personen-Betrieb mit FlowAI + Wartung + Förderung + DATEV</h3>
          <p className="text-muted-fg text-sm">
            5 × €19 (Core) + 5 × €29 (FlowAI) + €15 (Wartung) + €19 (Förderung) + €15 (DATEV) = <strong className="text-fg">€289 / Monat</strong>
          </p>
          <p className="text-xs text-muted-fg mt-2">
            Vergleich HERO Software: ab €450/Monat für vergleichbaren Funktionsumfang ohne KI.
          </p>
        </div>
      </section>

      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-muted-fg text-center">
          © 2026 epower GmbH
        </div>
      </footer>
    </div>
  );
}

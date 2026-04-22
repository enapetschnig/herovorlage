import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heatflow/ui";
import { Camera, Mail, Mic, ScanText, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FlowAiHubPage() {
  const trpc = await getTrpcCaller();
  const status = await trpc.flowai.status();

  const features: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    href: string | null;
    cta: string;
  }> = [
    {
      icon: Camera,
      title: "Foto → Angebot",
      description:
        "Heizungsraum-Foto wird via Claude Vision analysiert. System schlägt passende Wärmepumpe, Hydraulik-Anpassungen und offene Klärungspunkte vor.",
      href: "/flowai/photo-to-offer",
      cta: "Foto analysieren",
    },
    {
      icon: Mail,
      title: "Mail → Projekt",
      description:
        "Kunden-Anfrage per Paste oder IMAP-Pull einlesen. System extrahiert Kontakt, Projektumfang und Dringlichkeit — ein Klick, Projekt steht.",
      href: "/flowai/mail-to-project",
      cta: "Mail verarbeiten",
    },
    {
      icon: ScanText,
      title: "OCR Lieferantenrechnung",
      description:
        "PDF oder Bild einer Eingangsrechnung hochladen. Positionen werden gelesen, Lieferant erkannt, DATEV-Konto vorgeschlagen.",
      href: "/flowai/ocr-receipt",
      cta: "Beleg scannen",
    },
    {
      icon: Mic,
      title: "Sprache → Projekt",
      description:
        "Sprach-Memo aus dem Auto transkribieren (Whisper) und direkt in Kontakt + Projekt + Aufgaben überführen.",
      href: "/flowai/voice-to-project",
      cta: "Memo aufnehmen",
    },
    {
      icon: Sparkles,
      title: "Assistenz-Panel",
      description:
        "Kontextbewusster Chat rechts im UI — kennt aktuelles Projekt/Kontakt/Dokument, beantwortet Fragen, legt Tasks an.",
      href: null,
      cta: "Bald verfügbar",
    },
  ];

  return (
    <>
      <PageHeader
        title="FlowAI"
        description="Modul M12 — der KI-Layer von HeatFlow. Kein Wettbewerber im DACH-Raum bietet das 2026."
      >
        <div className="flex gap-2 pt-2">
          {status.mode === "live" ? (
            <Badge tone="success">🟢 Live mit {status.model}</Badge>
          ) : (
            <Badge tone="warning">🟡 Demo-Modus (ANTHROPIC_API_KEY fehlt in .env.local)</Badge>
          )}
        </div>
      </PageHeader>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="grid gap-4 md:grid-cols-2">
          {features.map((f) => {
            const Icon = f.icon;
            const disabled = f.href === null;
            const Wrapper = disabled
              ? ({ children }: { children: React.ReactNode }) => (
                  <div className="opacity-60 pointer-events-none">{children}</div>
                )
              : ({ children }: { children: React.ReactNode }) => <Link href={f.href!}>{children}</Link>;
            return (
              <Wrapper key={f.title}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                        <Icon className="size-4" />
                      </div>
                      {f.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-fg">{f.description}</p>
                    <div className="text-sm font-medium text-primary">{f.cta} →</div>
                  </CardContent>
                </Card>
              </Wrapper>
            );
          })}
        </div>

        {status.mode === "demo" && (
          <Card className="mt-6 border-warning/30 bg-warning/5">
            <CardContent className="text-sm">
              <div className="font-semibold mb-1">Demo-Modus aktiv</div>
              <p className="text-muted-fg">
                Alle FlowAI-Features liefern realistische Beispiel-Daten für diesen Demo-Tenant, damit du den Flow prüfen kannst, ohne einen Anthropic-API-Key zu brauchen. Um live zu gehen, setz{" "}
                <code className="font-mono bg-muted px-1 rounded">ANTHROPIC_API_KEY</code> in{" "}
                <code className="font-mono bg-muted px-1 rounded">.env.local</code> und starte den Dev-Server neu.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@heatflow/ui";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

const SAMPLE_MAIL = `Von: Max Mustermann <max.mustermann@example.at>
Betreff: Anfrage Wärmepumpe + PV für Neubau

Sehr geehrte Damen und Herren,

wir planen den Neubau eines Einfamilienhauses mit ca. 180 m² Wohnfläche in 9020 Klagenfurt, Seenstraße 12.
Im Zuge dessen möchten wir eine Wärmepumpe mit Pufferspeicher sowie eine Photovoltaik-Anlage installieren lassen.

Baubeginn ist voraussichtlich Sommer 2026. Ich freue mich auf Ihr Angebot und einen möglichen Vor-Ort-Termin.

Mit freundlichen Grüßen
Max Mustermann
Tel.: +43 664 123456`;

export function MailToProjectClient() {
  const router = useRouter();
  const [raw, setRaw] = useState(SAMPLE_MAIL);
  const extract = trpc.flowai.mailToProject.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const create = trpc.flowai.createFromMail.useMutation({
    onSuccess: ({ projectId, projectNumber }) => {
      toast.success(`Kontakt + Projekt ${projectNumber} angelegt`);
      router.push(`/projects/${projectId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const parseMail = () => {
    // Extract from/subject/body from the pasted block (heuristic)
    const fromMatch = raw.match(/^Von:?\s*(.+)$/mi);
    const subjectMatch = raw.match(/^Betreff:?\s*(.+)$/mi);
    const bodyStart = raw.search(/\n\n/);
    const body = bodyStart > 0 ? raw.slice(bodyStart).trim() : raw;
    extract.mutate({
      from: fromMatch?.[1]?.trim() ?? "unknown@example.com",
      subject: subjectMatch?.[1]?.trim() ?? "(kein Betreff)",
      body,
    });
  };

  const r = extract.data;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Mail einfügen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={16}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="font-mono text-xs"
            placeholder="Von: ...&#10;Betreff: ...&#10;&#10;Hallo, ..."
          />
          <Button
            className="w-full"
            size="lg"
            disabled={!raw.trim() || extract.isPending}
            onClick={parseMail}
          >
            {extract.isPending ? <><Loader2 className="size-4 animate-spin" /> Claude extrahiert…</> : <><Sparkles className="size-4" /> Analysieren</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {!r && !extract.isPending && (
          <Card className="h-full">
            <CardContent className="py-12 text-center text-muted-fg text-sm">
              Extraktion erscheint hier.
            </CardContent>
          </Card>
        )}

        {extract.isPending && (
          <Card>
            <CardContent className="py-16 text-center text-muted-fg space-y-3">
              <Loader2 className="size-6 animate-spin mx-auto" />
              <div>Claude liest die Mail…</div>
            </CardContent>
          </Card>
        )}

        {r && <ExtractedResult result={r} rawBody={raw} onCreate={(params) => create.mutate(params)} pending={create.isPending} />}
      </div>
    </div>
  );
}

function ExtractedResult({
  result, rawBody, onCreate, pending,
}: {
  result: NonNullable<ReturnType<typeof trpc.flowai.mailToProject.useMutation>["data"]>;
  rawBody: string;
  onCreate: (p: Parameters<ReturnType<typeof trpc.flowai.createFromMail.useMutation>["mutate"]>[0]) => void;
  pending: boolean;
}) {
  const ex = result.extracted;
  // Split the name into first+last heuristically
  const nameParts = (ex.name ?? "").split(" ").filter(Boolean);
  const firstName = nameParts.length >= 2 ? nameParts[0]! : undefined;
  const lastName = nameParts.length >= 2 ? nameParts.slice(1).join(" ") : (nameParts[0] ?? undefined);

  const title = `Anfrage ${lastName ?? ex.name ?? "Neukunde"} · ${ex.scope_summary.slice(0, 40)}${ex.scope_summary.length > 40 ? "…" : ""}`;

  return (
    <>
      {result._demo && <Badge tone="warning">Demo-Daten (ANTHROPIC_API_KEY fehlt)</Badge>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Klassifizierung</span>
            <Badge tone={result.intent === "neue_anfrage" ? "primary" : result.intent === "spam" ? "danger" : "neutral"}>
              {result.intent}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            <span className="text-muted-fg">Neue Anfrage:</span> <strong>{result.is_new_inquiry ? "Ja" : "Nein"}</strong>
          </div>
          <div>
            <span className="text-muted-fg">Dringlichkeit:</span> <strong>{ex.urgency}</strong>
          </div>
          <div>
            <span className="text-muted-fg">Gewerk:</span> <strong>{ex.trade}</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kontakt</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <Row label="Name" value={ex.name} />
          <Row label="E-Mail" value={ex.email} />
          <Row label="Telefon" value={ex.phone} />
          <Row label="Adresse" value={[ex.address_street, `${ex.address_zip ?? ""} ${ex.address_city ?? ""}`.trim()].filter(Boolean).join(", ")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Projekt-Zusammenfassung</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p className="leading-relaxed">{ex.scope_summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vorgeschlagene Aktionen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ul className="text-sm space-y-1">
            {result.suggested_actions.map((a) => (
              <li key={a} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" /> {a.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
          <Button
            className="w-full"
            disabled={pending || !ex.name}
            onClick={() =>
              onCreate({
                contact: {
                  firstName,
                  lastName,
                  email: ex.email ?? undefined,
                  phone: ex.phone ?? undefined,
                  street: ex.address_street ?? undefined,
                  zip: ex.address_zip ?? undefined,
                  city: ex.address_city ?? undefined,
                },
                project: {
                  title,
                  description: `${ex.scope_summary}\n\n--- Original-Mail ---\n${rawBody.slice(0, 2000)}`,
                  trade: ex.trade,
                },
              })
            }
          >
            {pending ? <><Loader2 className="size-4 animate-spin" /> Erstelle…</> : "Kontakt + Projekt anlegen"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[120px_1fr]">
      <span className="text-muted-fg">{label}</span>
      <span>{value || <span className="text-muted-fg italic">(nicht erkannt)</span>}</span>
    </div>
  );
}

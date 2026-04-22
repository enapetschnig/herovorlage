"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { toast } from "sonner";
import { Camera, Check, CircleHelp, FileText, Loader2, Sparkles, Upload, X } from "lucide-react";

export function PhotoToOfferClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<{ b64: string; preview: string; mime: "image/jpeg" | "image/png" | "image/webp" } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const analyze = trpc.flowai.photoToOffer.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const pick = async (file: File) => {
    const MAX = 8 * 1024 * 1024;
    if (file.size > MAX) { toast.error("Max. 8 MB."); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast.error("Nur JPEG/PNG/WebP."); return; }

    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
    const b64 = dataUrl.split(",")[1] ?? "";
    setImage({ b64, preview: dataUrl, mime: file.type as "image/jpeg" });
    analyze.reset();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  };

  const result = analyze.data;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Upload + Preview */}
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"} aspect-[4/3] relative overflow-hidden grid place-items-center`}
        >
          {image ? (
            <>
              <img src={image.preview} alt="Upload-Vorschau" className="absolute inset-0 w-full h-full object-cover" />
              <button
                onClick={() => { setImage(null); analyze.reset(); }}
                className="absolute top-2 right-2 size-7 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80"
                aria-label="Entfernen"
              ><X className="size-4" /></button>
            </>
          ) : (
            <div className="text-center space-y-2 p-8">
              <Upload className="size-10 text-muted-fg mx-auto" />
              <div className="font-medium text-sm">Foto hier ablegen</div>
              <div className="text-xs text-muted-fg">JPEG, PNG oder WebP — max. 8 MB</div>
              <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                <Camera className="size-4" /> Foto auswählen
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
              />
            </div>
          )}
        </div>

        <Button
          className="w-full" size="lg"
          disabled={!image || analyze.isPending}
          onClick={() => image && analyze.mutate({ image: image.b64, mediaType: image.mime })}
        >
          {analyze.isPending ? <><Loader2 className="size-4 animate-spin" /> Claude analysiert…</> : <><Sparkles className="size-4" /> Analysieren</>}
        </Button>

        <p className="text-xs text-muted-fg text-center">
          Tipp: Zeige Gesamtansicht des Heizungsraums, inkl. Kessel, Puffer und Verrohrung. Keine Seriennummern oder Personen.
        </p>
      </div>

      {/* Results */}
      <div>
        {!result && !analyze.isPending && (
          <Card className="h-full">
            <CardContent className="py-12 text-center text-muted-fg text-sm">
              Ergebnis erscheint hier.
            </CardContent>
          </Card>
        )}

        {analyze.isPending && (
          <Card className="h-full">
            <CardContent className="py-20 text-center text-muted-fg space-y-3">
              <Loader2 className="size-6 animate-spin mx-auto" />
              <div>Claude Vision analysiert das Foto…</div>
              <div className="text-xs">Prüft Bestandsanlage · Hydraulik · Platzverhältnisse</div>
            </CardContent>
          </Card>
        )}

        {result && <ResultCard result={result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: NonNullable<ReturnType<typeof trpc.flowai.photoToOffer.useMutation>["data"]> }) {
  const router = useRouter();

  const handoffToQuote = () => {
    // Build an initial set of positions from the top WP recommendation + hydraulic items
    const top = result.recommended_systems[0];
    const positions: Array<{ kind: string; description: string; quantity: number; unit: string; unitPrice: number; vatPct: number }> = [
      { kind: "title", description: `Wärmepumpen-Anlage — ${top?.brand ?? ""} ${top?.model ?? ""}`.trim(), quantity: 0, unit: "", unitPrice: 0, vatPct: 20 },
    ];
    if (top) {
      positions.push({
        kind: "article",
        description: `${top.brand} ${top.model} — ${top.power_kw} kW ${top.type.replace("_", "/")}`,
        quantity: 1, unit: "Stk", unitPrice: 0, vatPct: 20,
      });
    }
    if (result.hydraulics.buffer_liters) {
      positions.push({
        kind: "article",
        description: `Pufferspeicher ${result.hydraulics.buffer_liters}L`,
        quantity: 1, unit: "Stk", unitPrice: 0, vatPct: 20,
      });
    }
    if (result.hydraulics.needs_heating_rod) {
      positions.push({ kind: "article", description: "Heizstab 6kW als Backup", quantity: 1, unit: "Stk", unitPrice: 0, vatPct: 20 });
    }
    if (result.hydraulics.needs_expansion_vessel) {
      positions.push({ kind: "article", description: "Ausdehnungsgefäß", quantity: 1, unit: "Stk", unitPrice: 0, vatPct: 20 });
    }
    if (result.hydraulics.needs_mixer) {
      positions.push({ kind: "article", description: "3-Wege-Mischer mit Stellmotor", quantity: 1, unit: "Stk", unitPrice: 0, vatPct: 20 });
    }
    positions.push(
      { kind: "title", description: "Montage & Inbetriebnahme", quantity: 0, unit: "", unitPrice: 0, vatPct: 20 },
      { kind: "service", description: "Montage Wärmepumpe Außeneinheit", quantity: 1, unit: "Stk", unitPrice: 980, vatPct: 20 },
      { kind: "service", description: "Hydraulik-Anschluss komplett", quantity: 1, unit: "Stk", unitPrice: 1850, vatPct: 20 },
      { kind: "service", description: "Inbetriebnahme + Einweisung", quantity: 1, unit: "Stk", unitPrice: 480, vatPct: 20 },
    );
    if (result.open_questions.length > 0) {
      positions.push({
        kind: "text",
        description: "Offene Klärungspunkte (vor Auftragsbestätigung):\n" + result.open_questions.map((q) => `• ${q}`).join("\n"),
        quantity: 0, unit: "", unitPrice: 0, vatPct: 0,
      });
    }

    sessionStorage.setItem("heatflow.prefillDocument", JSON.stringify({
      positions,
      title: `Wärmepumpen-Angebot — ${top?.brand ?? "Sole/Wasser"} ${top?.model ?? ""}`.trim(),
      introText: `Im Anhang unser Angebot für die von uns empfohlene Wärmepumpen-Lösung.\n\nBasierend auf der Foto-Analyse: ${result.existing_system.type} ${result.existing_system.brand_guess} ${result.existing_system.model_guess} wird ersetzt.\n\n${top?.rationale ?? ""}`,
    }));
    toast.success("Positionen übernommen — wähle den Kunden im nächsten Schritt");
    router.push("/documents/new?type=quote&source=flowai");
  };

  return (
    <div className="space-y-4">
      {result._demo && (
        <Badge tone="warning">Demo-Daten (ANTHROPIC_API_KEY fehlt)</Badge>
      )}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="text-sm">
            <div className="font-semibold">Als Angebot übernehmen</div>
            <div className="text-muted-fg text-xs">Top-Empfehlung + Hydraulik + Standard-Services vorbefüllen</div>
          </div>
          <Button onClick={handoffToQuote}><FileText className="size-4" /> Angebot erstellen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bestandsanlage</span>
            <Badge tone={result.existing_system.confidence === "high" ? "success" : result.existing_system.confidence === "medium" ? "warning" : "neutral"}>
              Konfidenz: {result.existing_system.confidence}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="font-semibold text-base">
            {result.existing_system.type}
            {result.existing_system.brand_guess && ` · ${result.existing_system.brand_guess}`}
            {result.existing_system.model_guess && ` ${result.existing_system.model_guess}`}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {result.existing_system.year_guess && (
              <div><div className="text-muted-fg">Baujahr</div><div>ca. {result.existing_system.year_guess}</div></div>
            )}
            {result.existing_system.power_kw_guess && (
              <div><div className="text-muted-fg">Leistung</div><div>ca. {result.existing_system.power_kw_guess} kW</div></div>
            )}
          </div>
          <div className="pt-2 border-t border-border text-muted-fg">{result.condition_notes}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empfohlene Wärmepumpen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.recommended_systems.map((r, i) => (
            <div key={i} className="rounded border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{r.brand} {r.model}</div>
                <Badge tone={i === 0 ? "primary" : "neutral"}>
                  {r.power_kw} kW · {r.type.replace("_", "/")}
                </Badge>
              </div>
              <div className="text-xs text-muted-fg mt-1">{r.rationale}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hydraulik-Anpassungen</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <HydroItem label="Pufferspeicher" value={`${result.hydraulics.buffer_liters} L`} ok />
            <HydroItem label="Heizstab" value={result.hydraulics.needs_heating_rod ? "Ja" : "Nein"} ok={result.hydraulics.needs_heating_rod} />
            <HydroItem label="Ausdehnungsgefäß" value={result.hydraulics.needs_expansion_vessel ? "Ja" : "Nein"} ok={result.hydraulics.needs_expansion_vessel} />
            <HydroItem label="Mischer" value={result.hydraulics.needs_mixer ? "Ja" : "Nein"} ok={result.hydraulics.needs_mixer} />
          </div>
          <p className="text-xs text-muted-fg pt-2 border-t border-border">{result.hydraulics.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHelp className="size-4 text-warning" /> Offene Klärungspunkte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {result.open_questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-warning mt-0.5">•</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function HydroItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Check className={`size-4 ${ok ? "text-success" : "text-muted-fg"}`} />
      <span className="text-muted-fg">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

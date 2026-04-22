"use client";
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heatflow/ui";
import { CheckCircle2, FileUp, Flame, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Recommendation = { id: string; name: string; powerKw: number; fitScore: number };
type Result = {
  source: string;
  building: { totalHeatLoadKw: number; livingAreaM2?: number; heatedVolumeM3?: number; normOutdoorTempC?: number; standard?: string };
  rooms: Array<{ name: string; areaM2: number; heatLoadW: number }>;
  recommendedHeatPumpKw?: number;
};

export function HeizlastCard({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ result: Result; recommendations: Recommendation[] } | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const parse = trpc.heizlast.parseAndRecommend.useMutation({
    onSuccess: (r) => {
      setParsed(r as never);
      toast.success(`Heizlast erkannt: ${r.parsed.building.totalHeatLoadKw} kW (${r.parsed.source})`);
    },
    onError: (e) => toast.error(e.message),
  });

  const attach = trpc.heizlast.attachToProject.useMutation({
    onSuccess: () => toast.success("Heizlast mit Projekt verknüpft"),
    onError: (e) => toast.error(e.message),
  });

  const onFile = async (file: File) => {
    setFilename(file.name);
    setParsed(null);
    const xml = await file.text();
    parse.mutate({ xml });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Flame className="size-4 text-primary" /> Heizlast-Berechnung (M8)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-fg">
          XML-Export aus Viessmann ViGuide, Vaillant ProE, Buderus oder Hottgenroth ETU hier hochladen.
          System empfiehlt passende Wärmepumpe(n) aus dem Stamm.
        </p>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={parse.isPending}>
            {parse.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} XML-Datei wählen
          </Button>
          {filename && <span className="text-xs text-muted-fg">{filename}</span>}
          <input
            ref={inputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>

        {parsed && (
          <>
            <div className="grid sm:grid-cols-3 gap-3 pt-2">
              <Kpi label="Heizlast" value={`${parsed.result.building.totalHeatLoadKw} kW`} />
              {parsed.result.building.livingAreaM2 && <Kpi label="Wohnfläche" value={`${parsed.result.building.livingAreaM2} m²`} />}
              {parsed.result.recommendedHeatPumpKw && <Kpi label="Empfohlene WP-Größe" value={`${parsed.result.recommendedHeatPumpKw} kW`} accent="primary" />}
            </div>

            {parsed.result.building.standard && (
              <div className="text-xs text-muted-fg">Quelle: {parsed.result.source} · Standard: {parsed.result.building.standard}</div>
            )}

            {parsed.recommendations.length > 0 && (
              <div className="border border-border rounded p-3 bg-muted/30">
                <div className="text-xs text-muted-fg mb-2 flex items-center gap-1.5"><Sparkles className="size-3 text-primary" /> Passende Wärmepumpen aus dem Artikelstamm:</div>
                <ul className="space-y-1">
                  {parsed.recommendations.slice(0, 3).map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <span><strong>{r.name}</strong> · {r.powerKw} kW</span>
                      <Badge tone={r.fitScore > 0.85 ? "success" : "primary"}>
                        {Math.round(r.fitScore * 100)}% passend
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parsed.result.rooms.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-fg">Räume ({parsed.result.rooms.length})</summary>
                <table className="w-full mt-2 text-xs">
                  <thead className="text-muted-fg uppercase tracking-wider">
                    <tr>
                      <th className="text-left py-1">Raum</th>
                      <th className="text-right py-1 w-[80px]">Fläche</th>
                      <th className="text-right py-1 w-[80px]">Heizlast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.result.rooms.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1">{r.name}</td>
                        <td className="py-1 text-right tabular-nums">{r.areaM2} m²</td>
                        <td className="py-1 text-right tabular-nums">{r.heatLoadW} W</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                disabled={attach.isPending}
                onClick={() => attach.mutate({ projectId, result: parsed.result as never })}
              >
                {attach.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Mit Projekt verknüpfen
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "primary" }) {
  return (
    <div className="rounded border border-border p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-0.5 ${accent === "primary" ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

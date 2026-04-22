"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Field, Textarea } from "@heatflow/ui";
import { CheckCircle2, FileUp, Loader2, Mic, Square, Sparkles } from "lucide-react";
import { toast } from "sonner";

type State = "idle" | "recording" | "transcribing" | "extracting" | "done";

export function VoiceToProjectClient() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcript, setTranscript] = useState("");
  const [recordingMs, setRecordingMs] = useState(0);
  const [transcribeMode, setTranscribeMode] = useState<"live" | "demo" | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const extract = trpc.flowai.voiceToProject.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const create = trpc.flowai.createFromMail.useMutation({
    onSuccess: ({ projectId, projectNumber }) => {
      toast.success(`Projekt ${projectNumber} angelegt`);
      router.push(`/projects/${projectId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, []);

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = rec;
      rec.start();
      setState("recording");
      setRecordingMs(0);
      const start = Date.now();
      timerRef.current = setInterval(() => setRecordingMs(Date.now() - start), 200);
    } catch (e) {
      toast.error("Mikrofon nicht verfügbar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const stopRecord = () => {
    if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setState("idle");
  };

  const transcribe = async (blob: Blob) => {
    setState("transcribing");
    const fd = new FormData();
    fd.append("audio", blob, "memo.webm");
    fd.append("language", "de");
    const res = await fetch("/api/flowai/transcribe", { method: "POST", body: fd });
    if (!res.ok) {
      toast.error("Transkription fehlgeschlagen");
      setState("idle");
      return;
    }
    const data = await res.json() as { text: string; _demo: boolean };
    setTranscript(data.text);
    setTranscribeMode(data._demo ? "demo" : "live");
    setState("idle");
  };

  const onPickFile = async (file: File) => {
    setAudioBlob(file);
    transcribe(file);
  };

  const runExtract = async () => {
    setState("extracting");
    extract.mutate(
      { transcript },
      {
        onSettled: () => setState("done"),
      },
    );
  };

  const result = extract.data;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Step 1: Audio */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">1. Memo aufnehmen oder hochladen</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {state === "recording" ? (
              <div className="flex items-center gap-3 p-4 rounded border border-danger/30 bg-danger/5">
                <div className="size-3 rounded-full bg-danger animate-pulse" />
                <div className="flex-1">
                  <div className="font-medium">Aufnahme läuft…</div>
                  <div className="text-xs text-muted-fg tabular-nums">{(recordingMs / 1000).toFixed(1)} s</div>
                </div>
                <Button variant="danger" onClick={stopRecord}><Square className="size-4" /> Stop</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={startRecord} className="flex-1"><Mic className="size-4" /> Aufnahme starten</Button>
                <label>
                  <Button variant="secondary" type="button" onClick={(e) => (e.currentTarget.parentElement?.querySelector("input") as HTMLInputElement | null)?.click()}>
                    <FileUp className="size-4" /> Audio-Datei
                  </Button>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
                </label>
              </div>
            )}

            {audioBlob && state !== "recording" && (
              <div className="space-y-2">
                <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={state === "transcribing"}
                  onClick={() => transcribe(audioBlob)}
                >
                  {state === "transcribing" ? <><Loader2 className="size-4 animate-spin" /> Whisper transkribiert…</> : "Transkribieren"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>2. Transkript prüfen</span>
              {transcribeMode && <Badge tone={transcribeMode === "live" ? "success" : "warning"}>{transcribeMode === "live" ? "Whisper Live" : "Demo-Stub"}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={8}
                placeholder="Transkript erscheint hier — manuell editierbar"
              />
            </Field>
            <Button
              className="w-full"
              size="lg"
              disabled={!transcript.trim() || state === "extracting"}
              onClick={runExtract}
            >
              {state === "extracting" ? <><Loader2 className="size-4 animate-spin" /> Claude extrahiert…</> : <><Sparkles className="size-4" /> Strukturieren</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Step 3: Result */}
      <div>
        {!result ? (
          <Card className="h-full">
            <CardContent className="py-12 text-center text-muted-fg text-sm">
              Sprich ein 30-Sek-Memo ein, transkribier es, und sieh das Ergebnis hier.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {result._demo && <Badge tone="warning">Demo-Daten (ANTHROPIC_API_KEY fehlt)</Badge>}

            <Card>
              <CardHeader><CardTitle className="text-base">Kontakt</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <Row label="Name" value={`${result.contact.salutation ?? ""} ${result.contact.first_name ?? ""} ${result.contact.last_name ?? ""}`.trim()} />
                <Row label="Mobil" value={result.contact.mobile} />
                <Row label="E-Mail" value={result.contact.email} />
                <Row label="Adresse" value={[result.contact.address.street, `${result.contact.address.zip ?? ""} ${result.contact.address.city ?? ""}`.trim()].filter(Boolean).join(", ")} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Projekt</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="font-medium">{result.project.title}</div>
                <div className="text-muted-fg">{result.project.description}</div>
                <div className="flex gap-2 pt-1">
                  <Badge>{result.project.trade}</Badge>
                  <Badge tone="primary">{result.project.type_hint}</Badge>
                  {result.project.potential_value_eur && <Badge tone="success">€{result.project.potential_value_eur.toLocaleString("de-AT")}</Badge>}
                </div>
              </CardContent>
            </Card>

            {result.tasks.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Aufgaben</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {result.tasks.map((t, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="size-3 text-muted-fg" />
                        {t.title} <Badge>in {t.due_in_days} Tagen</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full"
              disabled={create.isPending || !result.contact.last_name}
              onClick={() => {
                const c = result.contact;
                const ex = result.project;
                create.mutate({
                  contact: {
                    firstName: c.first_name ?? undefined,
                    lastName: c.last_name ?? undefined,
                    companyName: c.company_name ?? undefined,
                    email: c.email ?? undefined,
                    phone: c.mobile ?? c.phone ?? undefined,
                    street: c.address.street ?? undefined,
                    zip: c.address.zip ?? undefined,
                    city: c.address.city ?? undefined,
                  },
                  project: {
                    title: ex.title,
                    description: ex.description,
                    trade: ex.trade,
                    potentialValue: ex.potential_value_eur ?? undefined,
                  },
                });
              }}
            >
              {create.isPending ? <><Loader2 className="size-4 animate-spin" /> Erstelle…</> : "Kontakt + Projekt anlegen"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[80px_1fr]">
      <span className="text-muted-fg">{label}</span>
      <span>{value || <span className="text-muted-fg italic">—</span>}</span>
    </div>
  );
}

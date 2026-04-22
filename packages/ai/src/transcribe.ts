/**
 * Audio-Transkription via OpenAI Whisper API.
 * Wrapped als minimal als möglich — kein OpenAI-SDK-Dependency, direkter fetch.
 *
 * Wenn OPENAI_API_KEY fehlt, wird ein Demo-Stub geliefert (festes Transkript).
 */

export type TranscribeInput = {
  audio: ArrayBuffer | Uint8Array;
  filename: string;
  mediaType: string; // "audio/webm", "audio/wav", "audio/mp3", …
  language?: string; // "de" empfohlen
  prompt?: string;   // glossary hint, e.g. "Wärmepumpe, Pufferspeicher, Vitocal"
};

export type TranscribeResult = {
  text: string;
  durationSec?: number;
  _demo: boolean;
};

const DEMO_TRANSCRIPT =
  "Also ich war heute beim Maximilian Mustermann in Klagenfurt, Seenstraße 12. " +
  "Der hat ein Einfamilienhaus, ungefähr 180 Quadratmeter Wohnfläche, " +
  "und will eine Wärmepumpe mit Pufferspeicher und PV-Anlage. " +
  "Baubeginn voraussichtlich Sommer 2026. " +
  "Telefonnummer ist plus 43 664 1234567. Termin für Vor-Ort nächste Woche bitte einplanen.";

export async function transcribeAudio(input: TranscribeInput): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await new Promise((r) => setTimeout(r, 800));
    return { text: DEMO_TRANSCRIPT, _demo: true };
  }

  const blob = new Blob([input.audio instanceof ArrayBuffer ? input.audio : input.audio.buffer.slice(input.audio.byteOffset, input.audio.byteOffset + input.audio.byteLength)], {
    type: input.mediaType,
  });
  const fd = new FormData();
  fd.append("file", blob, input.filename);
  fd.append("model", process.env.WHISPER_MODEL ?? "whisper-1");
  if (input.language) fd.append("language", input.language);
  if (input.prompt) fd.append("prompt", input.prompt);
  fd.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API: ${res.status} ${errText}`);
  }
  const data = (await res.json()) as { text: string; duration?: number };
  return { text: data.text, durationSec: data.duration, _demo: false };
}

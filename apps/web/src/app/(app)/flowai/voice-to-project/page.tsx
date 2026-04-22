import { PageHeader } from "@heatflow/ui";
import { VoiceToProjectClient } from "./VoiceToProjectClient";

export default function VoiceToProjectPage() {
  return (
    <>
      <PageHeader
        title="Sprache → Projekt"
        description="Sprich ein Memo ein. Whisper transkribiert, Claude extrahiert Kontakt + Projekt + Aufgaben."
      />
      <div className="p-6 max-w-5xl mx-auto">
        <VoiceToProjectClient />
      </div>
    </>
  );
}

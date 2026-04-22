import { PageHeader } from "@heatflow/ui";
import { MailToProjectClient } from "./MailToProjectClient";

export default function MailToProjectPage() {
  return (
    <>
      <PageHeader
        title="Mail → Projekt"
        description="Kundenanfrage einfügen. FlowAI klassifiziert, extrahiert Kontakt + Projektumfang und legt beides auf Wunsch direkt an."
      />
      <div className="p-6 max-w-5xl mx-auto">
        <MailToProjectClient />
      </div>
    </>
  );
}

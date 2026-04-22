import { PageHeader } from "@heatflow/ui";
import { ContactForm } from "../_components/ContactForm";

export default function NewContactPage() {
  return (
    <>
      <PageHeader title="Neuer Kontakt" description="Lege einen Kunden, Lieferanten oder Partner an." />
      <div className="p-6 max-w-4xl mx-auto">
        <ContactForm />
      </div>
    </>
  );
}

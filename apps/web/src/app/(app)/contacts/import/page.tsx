import { PageHeader } from "@heatflow/ui";
import { CsvImporter } from "./CsvImporter";

export default function ImportContactsPage() {
  return (
    <>
      <PageHeader
        title="Kontakte importieren"
        description="CSV mit Kunden oder Lieferanten hochladen. Spalten werden automatisch erkannt."
      />
      <div className="p-6 max-w-5xl mx-auto">
        <CsvImporter />
      </div>
    </>
  );
}

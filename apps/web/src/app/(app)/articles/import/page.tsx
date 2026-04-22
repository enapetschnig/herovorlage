import { PageHeader } from "@heatflow/ui";
import { DatanormImporter } from "./DatanormImporter";

export default function DatanormImportPage() {
  return (
    <>
      <PageHeader
        title="Datanorm-Import"
        description="Artikelstamm aus Großhandels-Datanorm-Datei (.001, .txt, .dn) importieren. Frauenthal, Holter, Pfeiffer, SHT — alle liefern Datanorm 4.0/5.0."
      />
      <div className="p-6 max-w-6xl mx-auto">
        <DatanormImporter />
      </div>
    </>
  );
}

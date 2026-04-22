import { PageHeader } from "@heatflow/ui";
import { OcrReceiptClient } from "./OcrReceiptClient";

export default function OcrReceiptPage() {
  return (
    <>
      <PageHeader
        title="OCR Lieferantenrechnung"
        description="PDF oder Bild einer Eingangsrechnung hochladen. Positionen, MwSt, Lieferant und DATEV-Konto werden automatisch extrahiert."
      />
      <div className="p-6 max-w-6xl mx-auto">
        <OcrReceiptClient />
      </div>
    </>
  );
}

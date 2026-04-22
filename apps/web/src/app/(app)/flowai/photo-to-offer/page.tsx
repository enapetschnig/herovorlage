import { PageHeader } from "@heatflow/ui";
import { PhotoToOfferClient } from "./PhotoToOfferClient";

export default function PhotoToOfferPage() {
  return (
    <>
      <PageHeader
        title="Foto → Angebot"
        description="Foto vom Heizungsraum hochladen. Claude Vision analysiert Bestandsanlage, empfiehlt passende Wärmepumpe, listet Hydraulik-Anpassungen und offene Klärungspunkte."
      />
      <div className="p-6 max-w-5xl mx-auto">
        <PhotoToOfferClient />
      </div>
    </>
  );
}

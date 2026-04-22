import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { BillingClient } from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const trpc = await getTrpcCaller();
  const overview = await trpc.billing.overview();
  const features = await trpc.tenant.features();

  return (
    <>
      <PageHeader
        title="Abrechnung & Module"
        description="Module verwalten, Plan upgraden, Stripe-Portal öffnen."
      />
      <div className="p-6 max-w-5xl mx-auto">
        <BillingClient
          initialOverview={overview as never}
          initialFeatures={features.map((f) => ({ featureKey: f.featureKey, active: f.active }))}
        />
      </div>
    </>
  );
}

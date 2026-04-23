import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  let data: {
    warehouses: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["warehouse"]["warehousesList"]>>;
    items: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["warehouse"]["stockItems"]>>;
    lowStock: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["warehouse"]["belowMinStock"]>>;
  } | null = null;
  let errorInfo: { message: string; stack: string } | null = null;

  try {
    const trpc = await getTrpcCaller();
    const [warehouses, items, lowStock] = await Promise.all([
      trpc.warehouse.warehousesList(),
      trpc.warehouse.stockItems({}),
      trpc.warehouse.belowMinStock(),
    ]);
    data = { warehouses, items, lowStock };
  } catch (e) {
    errorInfo = {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? (e.stack ?? "") : "",
    };
  }

  if (errorInfo) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-3">Lager — Fehler beim Laden</h1>
        <div className="rounded border border-danger/30 bg-danger/5 p-4 font-mono text-xs whitespace-pre-wrap break-all">
          <div><strong>Message:</strong> {errorInfo.message}</div>
          <pre className="mt-3 text-[10px] leading-tight">{errorInfo.stack}</pre>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <PageHeader title="Lager" description="Modul M6 — Lagerorte, Bestände, Bewegungen" />
      <div className="p-6 max-w-7xl mx-auto">
        <WarehouseClient
          initialWarehouses={data.warehouses.map((w) => ({ ...w, itemCount: Number(w.itemCount), valueSum: Number(w.valueSum) }))}
          initialItems={data.items}
          initialLowStock={data.lowStock.map((i) => ({ ...i, deficit: Number(i.deficit) }))}
        />
      </div>
    </>
  );
}

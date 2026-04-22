import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { WarehouseClient } from "./WarehouseClient";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const trpc = await getTrpcCaller();
  const [warehouses, items, lowStock] = await Promise.all([
    trpc.warehouse.warehousesList(),
    trpc.warehouse.stockItems({}),
    trpc.warehouse.belowMinStock(),
  ]);

  return (
    <>
      <PageHeader
        title="Lager"
        description="Modul M6 — Lagerorte, Bestände, Bewegungen"
      />
      <div className="p-6 max-w-7xl mx-auto">
        <WarehouseClient
          initialWarehouses={warehouses.map((w) => ({ ...w, itemCount: Number(w.itemCount), valueSum: Number(w.valueSum) }))}
          initialItems={items}
          initialLowStock={lowStock.map((i) => ({ ...i, deficit: Number(i.deficit) }))}
        />
      </div>
    </>
  );
}

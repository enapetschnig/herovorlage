import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Button, DataTable, EmptyState, PageHeader } from "@heatflow/ui";
import { FileUp, Package } from "lucide-react";
import { formatMoney } from "@heatflow/utils";

export const dynamic = "force-dynamic";

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const data = await trpc.articles.list({ page: 1, pageSize: 100, sortDir: "asc", search: sp.q });

  return (
    <>
      <PageHeader
        title="Artikel"
        description={`${data.total} Artikel im Stamm`}
        actions={
          <Link href="/articles/import">
            <Button variant="secondary"><FileUp className="size-4" /> Datanorm-Import</Button>
          </Link>
        }
      >
        <form className="flex gap-2 max-w-2xl pt-2" method="get">
          <input
            type="search" name="q" defaultValue={sp.q ?? ""}
            placeholder="Suche nach Name, Nummer, Hersteller-Nr…"
            className="flex-1 h-9 px-3 rounded-md border border-input bg-bg text-sm"
          />
        </form>
      </PageHeader>

      <div className="p-6 max-w-7xl mx-auto">
        <DataTable
          rows={data.items}
          rowKey={(a) => a.id}
          empty={<EmptyState icon={<Package className="size-5" />} title="Keine Artikel" description="Importiere via Datanorm (M1) oder lege manuell an." />}
          columns={[
            { id: "number", header: "Nr.", width: "150px", cell: (a) => <code className="text-xs text-muted-fg">{a.number}</code> },
            { id: "name", header: "Bezeichnung", cell: (a) => <span className="font-medium">{a.name}</span> },
            { id: "manufacturer", header: "Hersteller", width: "150px", cell: (a) => a.manufacturer ?? <span className="text-muted-fg">—</span> },
            { id: "ek", header: "EK", align: "right", width: "100px", cell: (a) => <span className="tabular-nums text-muted-fg">{formatMoney(Number(a.purchasePrice))}</span> },
            { id: "vk", header: "VK", align: "right", width: "100px", cell: (a) => <span className="tabular-nums font-medium">{formatMoney(Number(a.salePrice))}</span> },
            { id: "stock", header: "Bestand", align: "right", width: "100px", cell: (a) => <span className="tabular-nums">{Number(a.stock)} {a.unit}</span> },
          ]}
        />
      </div>
    </>
  );
}

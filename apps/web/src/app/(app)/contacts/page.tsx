import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Button, DataTable, EmptyState, PageHeader } from "@heatflow/ui";
import { Plus, Users } from "lucide-react";
import { CONTACT_TYPES } from "@heatflow/utils/constants";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const page = sp.page ? Number(sp.page) : 1;
  const data = await trpc.contacts.list({
    page,
    pageSize: 50,
    sortBy: "name",
    sortDir: "asc",
    search: sp.q,
    type: CONTACT_TYPES.includes(sp.type as (typeof CONTACT_TYPES)[number]) ? (sp.type as (typeof CONTACT_TYPES)[number]) : undefined,
  });

  const typeLabel: Record<string, string> = {
    customer: "Kunde",
    supplier: "Lieferant",
    partner: "Partner",
    other: "Sonstige",
  };

  return (
    <>
      <PageHeader
        title="Kontakte"
        description={`${data.total} Einträge insgesamt`}
        actions={
          <>
            <Link href="/contacts/import">
              <Button variant="secondary">CSV importieren</Button>
            </Link>
            <Link href="/contacts/new">
              <Button><Plus className="size-4" /> Neuer Kontakt</Button>
            </Link>
          </>
        }
      >
        <form className="flex gap-2 max-w-2xl pt-2" method="get">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Suche nach Name, E-Mail, Kundennr…"
            className="flex-1 h-9 px-3 rounded-md border border-input bg-bg text-sm"
          />
          <select
            name="type"
            defaultValue={sp.type ?? ""}
            className="h-9 px-3 rounded-md border border-input bg-bg text-sm"
          >
            <option value="">Alle Typen</option>
            {CONTACT_TYPES.map((t) => (<option key={t} value={t}>{typeLabel[t]}</option>))}
          </select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </PageHeader>

      <div className="p-6 max-w-7xl mx-auto">
        <DataTable
          rows={data.items}
          rowKey={(c) => c.id}
          empty={
            <EmptyState
              icon={<Users className="size-5" />}
              title="Keine Kontakte gefunden"
              description="Versuche eine andere Suche oder lege einen neuen Kontakt an."
              action={<Link href="/contacts/new"><Button><Plus className="size-4" /> Kontakt anlegen</Button></Link>}
            />
          }
          columns={[
            {
              id: "name",
              header: "Name",
              cell: (c) => (
                <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                  {c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—"}
                </Link>
              ),
            },
            {
              id: "type",
              header: "Typ",
              width: "120px",
              cell: (c) => (
                <Badge tone={c.type === "supplier" ? "warning" : c.type === "customer" ? "primary" : "neutral"}>
                  {typeLabel[c.type] ?? c.type}
                </Badge>
              ),
            },
            { id: "number", header: "Kdnr.", width: "130px", cell: (c) => <code className="text-xs text-muted-fg">{c.customerNumber}</code> },
            { id: "email", header: "E-Mail", cell: (c) => c.email ?? <span className="text-muted-fg">—</span> },
            { id: "phone", header: "Telefon", width: "180px", cell: (c) => c.mobile ?? c.phone ?? <span className="text-muted-fg">—</span> },
          ]}
        />

        {data.total > data.pageSize && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-fg">
            <div>Seite {data.page} von {Math.ceil(data.total / data.pageSize)}</div>
            <div className="flex gap-2">
              {data.page > 1 && (
                <Link href={`/contacts?page=${data.page - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>
                  <Button variant="outline" size="sm">Zurück</Button>
                </Link>
              )}
              {data.page * data.pageSize < data.total && (
                <Link href={`/contacts?page=${data.page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>
                  <Button variant="outline" size="sm">Weiter</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { ProjectForm } from "../_components/ProjectForm";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ contactId?: string }> }) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const [contacts, members] = await Promise.all([
    trpc.contacts.list({ page: 1, pageSize: 200, sortBy: "name", sortDir: "asc", type: "customer" }),
    trpc.tenant.members(),
  ]);
  return (
    <>
      <PageHeader title="Neues Projekt" description="Bau-/Auftragsvorgang anlegen." />
      <div className="p-6 max-w-3xl mx-auto">
        <ProjectForm
          contacts={contacts.items.map((c) => ({
            id: c.id,
            label: c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber || c.id,
          }))}
          members={members}
          presetContactId={sp.contactId}
        />
      </div>
    </>
  );
}

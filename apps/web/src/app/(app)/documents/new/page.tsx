import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { DocumentForm } from "../_components/DocumentForm";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; projectId?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const trpc = await getTrpcCaller();
  const [contactsData, projectsData] = await Promise.all([
    trpc.contacts.list({ page: 1, pageSize: 200, sortBy: "name", sortDir: "asc" }),
    trpc.projects.list({ page: 1, pageSize: 200, sortDir: "desc" }),
  ]);

  return (
    <>
      <PageHeader title="Neues Dokument" description="Angebot, Rechnung, Lieferschein …" />
      <div className="p-6 max-w-6xl mx-auto">
        <DocumentForm
          contacts={contactsData.items.map((c) => ({
            id: c.id,
            label: (c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()) || c.customerNumber || c.id,
          }))}
          projects={projectsData.items.map((p) => ({
            id: p.id,
            label: `${p.number} — ${p.title}`,
            contactId: p.contactId,
          }))}
          presetContactId={sp.contactId}
          presetProjectId={sp.projectId}
          presetType={sp.type as "quote" | "invoice" | undefined}
        />
      </div>
    </>
  );
}

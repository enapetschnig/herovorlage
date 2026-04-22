import { notFound } from "next/navigation";
import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { ProjectForm } from "../../_components/ProjectForm";
import type { ProjectStatus } from "@heatflow/utils/constants";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getTrpcCaller();
  let p;
  try { p = await trpc.projects.byId({ id }); } catch { notFound(); }

  const [contactsData, members] = await Promise.all([
    trpc.contacts.list({ page: 1, pageSize: 200, sortBy: "name", sortDir: "asc" }),
    trpc.tenant.members(),
  ]);

  return (
    <>
      <PageHeader title={`${p.title} bearbeiten`} description={p.number} />
      <div className="p-6 max-w-3xl mx-auto">
        <ProjectForm
          mode="edit"
          projectId={p.id}
          contacts={contactsData.items.map((c) => ({
            id: c.id,
            label: c.companyName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.customerNumber || c.id,
            sub: c.customerNumber ?? undefined,
          }))}
          members={members}
          defaults={{
            title: p.title,
            contactId: p.contactId,
            status: p.status as ProjectStatus,
            trade: p.trade ?? undefined,
            startDate: p.startDate ?? undefined,
            endDate: p.endDate ?? undefined,
            potentialValue: p.potentialValue ? Number(p.potentialValue) : undefined,
            source: p.source ?? undefined,
            description: p.description ?? undefined,
            responsibleUserId: p.responsibleUserId ?? undefined,
          }}
        />
      </div>
    </>
  );
}

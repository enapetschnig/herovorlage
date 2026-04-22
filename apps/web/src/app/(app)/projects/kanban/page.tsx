import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { KanbanBoard } from "../_components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const trpc = await getTrpcCaller();
  const data = await trpc.kanban.board({});
  return (
    <>
      <PageHeader
        title="Projekt-Pipeline"
        description="Drag & Drop um Projekt-Status zu ändern. Modul M14."
      />
      <div className="p-6 max-w-[1600px] mx-auto">
        <KanbanBoard initialLanes={data.lanes} />
      </div>
    </>
  );
}

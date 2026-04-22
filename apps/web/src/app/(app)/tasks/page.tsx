import Link from "next/link";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, DataTable, EmptyState, PageHeader } from "@heatflow/ui";
import { CheckSquare } from "lucide-react";
import { formatDate } from "@heatflow/utils";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const trpc = await getTrpcCaller();
  const data = await trpc.tasks.list({ page: 1, pageSize: 100, sortDir: "desc", status: "open" });

  return (
    <>
      <PageHeader title="Aufgaben" description={`${data.total} offene Aufgaben`} />
      <div className="p-6 max-w-7xl mx-auto">
        <DataTable
          rows={data.items}
          rowKey={(t) => t.id}
          empty={<EmptyState icon={<CheckSquare className="size-5" />} title="Keine offenen Aufgaben" description="Alle erledigt — gut gemacht!" />}
          columns={[
            { id: "title", header: "Titel",
              cell: (t) => (
                <div>
                  <div className="font-medium">{t.title}</div>
                  {t.description && <div className="text-xs text-muted-fg line-clamp-1">{t.description}</div>}
                </div>
              ),
            },
            { id: "project", header: "Projekt", width: "200px",
              cell: (t) => t.projectId ? (
                <Link href={`/projects/${t.projectId}`} className="text-sm hover:underline">Projekt öffnen</Link>
              ) : <span className="text-muted-fg">—</span>,
            },
            { id: "due", header: "Fällig", width: "130px",
              cell: (t) => t.dueDate ? <span className="text-sm">{formatDate(t.dueDate)}</span> : <span className="text-muted-fg">—</span>,
            },
            { id: "priority", header: "Priorität", width: "120px",
              cell: (t) => {
                if (t.priority === "urgent") return <Badge tone="danger">Dringend</Badge>;
                if (t.priority === "high") return <Badge tone="warning">Hoch</Badge>;
                if (t.priority === "low") return <Badge tone="neutral">Niedrig</Badge>;
                return <Badge>Normal</Badge>;
              },
            },
          ]}
        />
      </div>
    </>
  );
}

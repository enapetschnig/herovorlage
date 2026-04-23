import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrpcCaller } from "@/server/trpc";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, StatusBadge, Tabs } from "@heatflow/ui";
import { formatMoney, formatAgo, formatDate } from "@heatflow/utils";
import { CheckCircle2, Circle, FileText, Pencil, Plus } from "lucide-react";
import { AddLogbookEntry } from "../../_components/AddLogbookEntry";
import { FileUpload } from "../../_components/FileUpload";
import { ProjectTimeTab } from "../_components/ProjectTimeTab";
import { ProjectCalculationTab } from "../_components/ProjectCalculationTab";
import { ProjectFundingTab } from "../_components/ProjectFundingTab";
import { ProjectChatTab } from "../_components/ProjectChatTab";
import { HeizlastCard } from "../_components/HeizlastCard";
import { ChecklistCard } from "../../_components/ChecklistCard";
import { PipelineStepper } from "./_components/PipelineStepper";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trpc = await getTrpcCaller();
  let project;
  try {
    project = await trpc.projects.byId({ id });
  } catch {
    notFound();
  }
  const pipelineStages = await trpc.tenant.pipelineStages();

  const contactName = project.contact
    ? project.contact.companyName ?? `${project.contact.firstName ?? ""} ${project.contact.lastName ?? ""}`.trim()
    : "—";

  return (
    <>
      <PageHeader
        title={project.title}
        description={`${project.number} · ${contactName}`}
        actions={
          <>
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="secondary"><Pencil className="size-4" /> Bearbeiten</Button>
            </Link>
            <Link href={`/documents/new?projectId=${project.id}&contactId=${project.contactId}`}>
              <Button><FileText className="size-4" /> Angebot erstellen</Button>
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <StatusBadge status={project.status} />
          {project.trade && <Badge>{project.trade}</Badge>}
          {project.potentialValue && (
            <Badge tone="primary">Potential: {formatMoney(Number(project.potentialValue))}</Badge>
          )}
        </div>
      </PageHeader>

      <div className="px-6 pt-4 max-w-7xl mx-auto w-full">
        <PipelineStepper
          projectId={project.id}
          stages={pipelineStages}
          currentStage={(project as { pipelineStage?: string | null }).pipelineStage ?? null}
        />
      </div>

      <Tabs
        items={[
          {
            id: "overview", label: "Übersicht",
            content: <OverviewTab project={project} contactName={contactName} />,
          },
          {
            id: "logbook", label: "Logbuch",
            badge: project.logbook.length > 0 ? <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{project.logbook.length}</span> : null,
            content: (
              <div className="space-y-4">
                <AddLogbookEntry entityType="project" entityId={project.id} />
                <LogbookTab entries={project.logbook} />
              </div>
            ),
          },
          {
            id: "documents", label: "Dokumente",
            badge: project.documents.length > 0 ? <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{project.documents.length}</span> : null,
            content: <DocumentsTab projectId={project.id} contactId={project.contactId} documents={project.documents} />,
          },
          {
            id: "tasks", label: "Aufgaben",
            badge: project.tasks.length > 0 ? <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{project.tasks.length}</span> : null,
            content: <TasksTab tasks={project.tasks} />,
          },
          {
            id: "time", label: "Zeit",
            content: <ProjectTimeTab projectId={project.id} />,
          },
          {
            id: "calculation", label: "Soll/Ist",
            content: <ProjectCalculationTab projectId={project.id} />,
          },
          {
            id: "funding", label: "Förderung",
            content: <ProjectFundingTab projectId={project.id} />,
          },
          {
            id: "chat", label: "Chat",
            content: <ProjectChatTab projectId={project.id} />,
          },
          {
            id: "checklists", label: "Checklisten",
            content: <ChecklistCard entityType="project" entityId={project.id} />,
          },
          {
            id: "heizlast", label: "Heizlast",
            content: <HeizlastCard projectId={project.id} />,
          },
          {
            id: "files", label: "Dateien",
            badge: project.files.length > 0 ? <span className="px-1.5 py-0.5 rounded bg-muted text-xs">{project.files.length}</span> : null,
            content: (
              <FileUpload
                entityType="project"
                entityId={project.id}
                files={project.files.map((f) => ({
                  id: f.id,
                  filename: f.filename,
                  mimeType: f.mimeType,
                  size: f.size,
                  storageBucket: f.storageBucket,
                  storageKey: f.storageKey,
                  createdAt: f.createdAt,
                }))}
              />
            ),
          },
        ]}
      />
    </>
  );
}

function OverviewTab({ project, contactName }: { project: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["projects"]["byId"]>>; contactName: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Beschreibung</CardTitle></CardHeader>
        <CardContent>
          {project.description ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{project.description}</p>
          ) : (
            <p className="text-sm text-muted-fg">Keine Beschreibung hinterlegt.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Eckdaten</CardTitle></CardHeader>
        <CardContent>
          <dl className="text-sm space-y-2">
            <DlRow label="Kunde" value={
              <Link href={`/contacts/${project.contactId}`} className="hover:underline">{contactName}</Link>
            } />
            <DlRow label="Status" value={<StatusBadge status={project.status} />} />
            <DlRow label="Gewerk" value={project.trade ?? "—"} />
            {project.startDate && <DlRow label="Start" value={formatDate(project.startDate)} />}
            {project.endDate && <DlRow label="Ende" value={formatDate(project.endDate)} />}
            {project.source && <DlRow label="Quelle" value={project.source} />}
            <DlRow label="Angelegt" value={formatAgo(project.createdAt)} />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function LogbookTab({ entries }: { entries: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["projects"]["byId"]>>["logbook"] }) {
  if (entries.length === 0) {
    return <EmptyState icon={<Circle className="size-5" />} title="Noch keine Einträge" description="System-Events und manuelle Notizen erscheinen hier." />;
  }
  return (
    <ol className="relative border-l border-border ml-3 space-y-5 py-2">
      {entries.map((e) => (
        <li key={e.id} className="ml-6">
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-primary ring-4 ring-bg" />
          <div className="text-xs text-muted-fg">{formatAgo(e.occurredAt)}</div>
          <p className="text-sm mt-0.5">{e.message}</p>
          {e.isSystemEvent && <Badge className="mt-1">System</Badge>}
        </li>
      ))}
    </ol>
  );
}

function DocumentsTab({
  projectId, contactId, documents,
}: {
  projectId: string; contactId: string;
  documents: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["projects"]["byId"]>>["documents"];
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="Noch keine Dokumente"
        description="Erstelle das erste Angebot für dieses Projekt."
        action={
          <Link href={`/documents/new?projectId=${projectId}&contactId=${contactId}`}>
            <Button><Plus className="size-4" /> Angebot erstellen</Button>
          </Link>
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
      {documents.map((d) => (
        <li key={d.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30">
          <div>
            <Link href={`/documents/${d.id}`} className="font-medium hover:underline">
              {d.title ?? d.number}
            </Link>
            <div className="text-xs text-muted-fg">{d.number} · {d.type}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums">{formatMoney(Number(d.totalGross))}</span>
            <StatusBadge status={d.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TasksTab({ tasks }: { tasks: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["projects"]["byId"]>>["tasks"] }) {
  if (tasks.length === 0) {
    return <EmptyState icon={<Circle className="size-5" />} title="Keine offenen Aufgaben" description="Aufgaben helfen, das Projekt strukturiert abzuwickeln." />;
  }
  return (
    <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
      {tasks.map((t) => (
        <li key={t.id} className="px-4 py-3 flex items-center gap-3">
          {t.status === "done" ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-fg" />}
          <div className="flex-1 min-w-0">
            <div className={t.status === "done" ? "line-through text-muted-fg" : ""}>{t.title}</div>
            {t.description && <div className="text-xs text-muted-fg">{t.description}</div>}
          </div>
          {t.priority === "urgent" && <Badge tone="danger">Dringend</Badge>}
          {t.priority === "high" && <Badge tone="warning">Hoch</Badge>}
          {t.dueDate && <span className="text-xs text-muted-fg">{formatDate(t.dueDate)}</span>}
        </li>
      ))}
    </ul>
  );
}

function DlRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-2">
      <dt className="text-muted-fg">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

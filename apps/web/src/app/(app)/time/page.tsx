import { getTrpcCaller } from "@/server/trpc";
import { auth } from "@heatflow/auth";
import { PageHeader } from "@heatflow/ui";
import { TimeDayView } from "./_components/TimeDayView";

export const dynamic = "force-dynamic";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; user?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const trpc = await getTrpcCaller();

  const today = new Date().toISOString().slice(0, 10);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [members, categories, projectsData] = await Promise.all([
    trpc.tenant.members(),
    trpc.time.categories(),
    trpc.projects.list({ page: 1, pageSize: 200, sortDir: "desc" }),
  ]);

  const userId = sp.user && members.some((m) => m.id === sp.user) ? sp.user : session!.user!.id;

  const data = await trpc.time.byDay({ userId, date });

  return (
    <>
      <PageHeader
        title="Zeiterfassung"
        description={`Tag: ${date} · Mitarbeiter: ${members.find((m) => m.id === userId)?.name ?? "—"}`}
      />
      <div className="p-6 max-w-5xl mx-auto">
        <TimeDayView
          date={date}
          userId={userId}
          currentUserId={session!.user!.id}
          isAdmin={session!.user!.role === "owner" || session!.user!.role === "admin"}
          members={members}
          categories={categories}
          projects={projectsData.items.map((p) => ({ id: p.id, label: `${p.number} — ${p.title}` }))}
        />
      </div>
    </>
  );
}

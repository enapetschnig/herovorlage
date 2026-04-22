import { auth } from "@heatflow/auth";
import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { TimeWeekView } from "../_components/TimeWeekView";

export const dynamic = "force-dynamic";

function startOfIsoWeek(d: Date): Date {
  const date = new Date(d);
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - dow + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export default async function TimeWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; user?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const trpc = await getTrpcCaller();

  const today = new Date();
  const fromDate = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? new Date(sp.week + "T00:00:00Z") : startOfIsoWeek(today);
  const toDate = new Date(fromDate);
  toDate.setUTCDate(toDate.getUTCDate() + 6);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const members = await trpc.tenant.members();
  const userId = sp.user && members.some((m) => m.id === sp.user) ? sp.user : session!.user!.id;

  const data = await trpc.time.byWeek({ userId, fromDate: fromStr, toDate: toStr });

  return (
    <>
      <PageHeader
        title="Zeiterfassung — Woche"
        description={`KW ${getIsoWeek(fromDate)} · ${members.find((m) => m.id === userId)?.name ?? "—"}`}
      />
      <div className="p-6 max-w-7xl mx-auto">
        <TimeWeekView
          weekStart={fromStr}
          userId={userId}
          currentUserId={session!.user!.id}
          isApprover={session!.user!.role === "owner" || session!.user!.role === "admin" || session!.user!.role === "office"}
          members={members}
          initialData={data}
        />
      </div>
    </>
  );
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

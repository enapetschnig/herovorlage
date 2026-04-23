import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { PlantafelBoard } from "./_components/PlantafelBoard";

export const dynamic = "force-dynamic";

function startOfIsoWeek(d: Date): Date {
  const date = new Date(d);
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - dow + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;

  const fromDate =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? new Date(sp.week + "T00:00:00Z") : startOfIsoWeek(new Date());
  const toDate = new Date(fromDate);
  toDate.setUTCDate(toDate.getUTCDate() + 13);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  let data: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["schedule"]["forRange"]>> | null = null;
  let errorInfo: { message: string; stack: string } | null = null;

  try {
    const trpc = await getTrpcCaller();
    data = await trpc.schedule.forRange({ fromDate: fromStr, toDate: toStr });
  } catch (e) {
    errorInfo = {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? (e.stack ?? "") : "",
    };
  }

  if (errorInfo) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-3">Plantafel — Fehler beim Laden</h1>
        <div className="rounded border border-danger/30 bg-danger/5 p-4 font-mono text-xs whitespace-pre-wrap break-all">
          <div><strong>Message:</strong> {errorInfo.message}</div>
          <pre className="mt-3 text-[10px] leading-tight">{errorInfo.stack}</pre>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Plantafel"
        description="Modul M4 — Aufgaben + Wartungen pro Mitarbeiter pro Tag. Drag & Drop zum Verschieben."
      />
      <div className="p-4 max-w-[1800px] mx-auto">
        <PlantafelBoard
          weekStart={fromStr}
          initialMembers={data.members}
          initialSlots={data.slots}
        />
      </div>
    </>
  );
}

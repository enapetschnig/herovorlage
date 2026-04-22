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
  const trpc = await getTrpcCaller();

  const fromDate =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? new Date(sp.week + "T00:00:00Z") : startOfIsoWeek(new Date());
  // Show 14 days (2 weeks)
  const toDate = new Date(fromDate);
  toDate.setUTCDate(toDate.getUTCDate() + 13);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const data = await trpc.schedule.forRange({ fromDate: fromStr, toDate: toStr });

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

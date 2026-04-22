import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { ReminderClient } from "./ReminderClient";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const trpc = await getTrpcCaller();
  const overdue = await trpc.reminders.overdueList();
  return (
    <>
      <PageHeader
        title="Mahnwesen"
        description="Modul M11 — überfällige Rechnungen, Mahnstufen 1–3, SEPA-Lastschrift-XML"
      />
      <div className="p-6 max-w-6xl mx-auto">
        <ReminderClient initialOverdue={overdue} />
      </div>
    </>
  );
}

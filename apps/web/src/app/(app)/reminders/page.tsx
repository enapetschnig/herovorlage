import { getTrpcCaller } from "@/server/trpc";
import { PageHeader } from "@heatflow/ui";
import { ReminderClient } from "./ReminderClient";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  let data: Awaited<ReturnType<Awaited<ReturnType<typeof getTrpcCaller>>["reminders"]["overdueList"]>> | null = null;
  let errorInfo: { message: string; stack: string } | null = null;

  try {
    const trpc = await getTrpcCaller();
    data = await trpc.reminders.overdueList();
  } catch (e) {
    errorInfo = {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? (e.stack ?? "") : "",
    };
  }

  if (errorInfo) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-3">Mahnwesen — Fehler beim Laden</h1>
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
        title="Mahnwesen"
        description="Modul M11 — überfällige Rechnungen, Mahnstufen 1–3, SEPA-Lastschrift-XML"
      />
      <div className="p-6 max-w-6xl mx-auto">
        <ReminderClient initialOverdue={data} />
      </div>
    </>
  );
}

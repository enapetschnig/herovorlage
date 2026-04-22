"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@heatflow/ui";
import { formatDate, formatMoney } from "@heatflow/utils";
import { toast } from "sonner";
import { CheckCircle2, FileWarning, Loader2, Mail, Send, Wallet } from "lucide-react";

type OverdueRow = {
  id: string;
  number: string;
  documentDate: string | Date;
  dueDate: string | Date | null;
  totalGross: string;
  currency: string;
  status: string;
  contactId: string;
  contactName: string | null;
  contactEmail: string | null;
  daysOverdue: number;
};

export function ReminderClient({ initialOverdue }: { initialOverdue: OverdueRow[] }) {
  const router = useRouter();
  const q = trpc.reminders.overdueList.useQuery(undefined, { initialData: initialOverdue });
  const data = q.data ?? initialOverdue;

  const markOverdue = trpc.reminders.markOverdue.useMutation({
    onSuccess: ({ marked }) => { toast.success(`${marked} Rechnungen auf "überfällig" gesetzt`); q.refetch(); router.refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const sendReminder = trpc.reminders.sendReminder.useMutation({
    onSuccess: () => { toast.success("Mahnung versendet"); q.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const markPaid = trpc.reminders.markPaid.useMutation({
    onSuccess: () => { toast.success("Als bezahlt markiert"); q.refetch(); router.refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const totalOpen = data.reduce((s, d) => s + Number(d.totalGross), 0);
  const totalOver14 = data.filter((d) => d.daysOverdue > 14).reduce((s, d) => s + Number(d.totalGross), 0);
  const totalOver30 = data.filter((d) => d.daysOverdue > 30).reduce((s, d) => s + Number(d.totalGross), 0);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-3">
        <Kpi label="Überfällige Rechnungen" value={String(data.length)} />
        <Kpi label="Offen gesamt" value={formatMoney(totalOpen)} />
        <Kpi label="Über 14 Tage" value={formatMoney(totalOver14)} accent={totalOver14 > 0 ? "warning" : "neutral"} />
        <Kpi label="Über 30 Tage" value={formatMoney(totalOver30)} accent={totalOver30 > 0 ? "danger" : "neutral"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Überfällige Rechnungen</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={markOverdue.isPending}
              onClick={() => markOverdue.mutate()}
              title="Findet Rechnungen mit überfälligem Belegdatum + Status='sent' und setzt sie auf 'overdue'"
            >
              {markOverdue.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Status neu prüfen
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-5" />}
              title="Keine überfälligen Rechnungen"
              description="Alle Forderungen sind im grünen Bereich."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-fg">
                <tr>
                  <th className="text-left px-4 py-2.5">Nummer</th>
                  <th className="text-left px-4 py-2.5">Kunde</th>
                  <th className="text-left px-4 py-2.5 w-[120px]">Fällig am</th>
                  <th className="text-right px-4 py-2.5 w-[100px]">Tage</th>
                  <th className="text-right px-4 py-2.5 w-[120px]">Betrag</th>
                  <th className="text-right px-4 py-2.5 w-[280px]">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => {
                  const daysOver = Number(d.daysOverdue);
                  const tone: "neutral" | "warning" | "danger" = daysOver > 30 ? "danger" : daysOver > 14 ? "warning" : "neutral";
                  return (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-3"><Link href={`/documents/${d.id}`} className="font-medium hover:underline">{d.number}</Link></td>
                      <td className="px-4 py-3"><Link href={`/contacts/${d.contactId}`} className="hover:underline">{d.contactName}</Link></td>
                      <td className="px-4 py-3 text-xs text-muted-fg">{d.dueDate ? formatDate(d.dueDate) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge tone={tone}>{daysOver}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatMoney(Number(d.totalGross), { currency: d.currency as "EUR" | "CHF" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {[1, 2, 3].map((lvl) => (
                            <Button
                              key={lvl}
                              size="sm"
                              variant={lvl === 3 ? "danger" : lvl === 2 ? "secondary" : "ghost"}
                              disabled={!d.contactEmail || sendReminder.isPending}
                              title={d.contactEmail ? `Mahnstufe ${lvl} senden` : "Keine E-Mail beim Kontakt"}
                              onClick={() => {
                                if (!window.confirm(`Mahnstufe ${lvl} an ${d.contactEmail} senden?`)) return;
                                sendReminder.mutate({ documentId: d.id, level: lvl as 1 | 2 | 3 });
                              }}
                            >
                              {sendReminder.isPending && sendReminder.variables?.documentId === d.id && sendReminder.variables?.level === lvl ?
                                <Loader2 className="size-3 animate-spin" /> :
                                <><Mail className="size-3" /> M{lvl}</>}
                            </Button>
                          ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={markPaid.isPending}
                            onClick={() => markPaid.mutate({ documentId: d.id })}
                            title="Als bezahlt markieren"
                          >
                            <Wallet className="size-3" /> Bezahlt
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="size-4" /> SEPA-Lastschrift-XML</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Für Kunden mit hinterlegter IBAN und SEPA-Mandat kannst du die offenen Rechnungen als
            Sammel-Lastschrift einziehen. Das XML im Format <code className="font-mono text-xs">pain.008.001.08 CORE</code> ist
            direkt importierbar in jeder DE/AT-Bank.
          </p>
          <p className="text-xs text-muted-fg">
            Voraussetzung: Creditor-Identifier in den Tenant-Stammdaten + Mandate-ID pro Kontakt.
            Generierung in V1 manuell — Auto-Cron-Job kommt in Phase 7.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "warning" | "danger" | "neutral" }) {
  const cls = accent === "danger" ? "text-danger" : accent === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-fg">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button, Field, Textarea } from "@heatflow/ui";
import { toast } from "sonner";
import { CheckCircle2, Loader2, X } from "lucide-react";

/**
 * Per CLAUDE.md Teil M.5 — standard heat-pump maintenance protocol checklist.
 * In V1 we pre-fill all items as checked; technician unchecks if an issue occurred.
 */
const DEFAULT_CHECKS = [
  "Kältekreislauf geprüft",
  "Verdampfer/Kondensator gereinigt",
  "Solequalität geprüft (Sole-WP)",
  "Sicherheitsventile geprüft",
  "Elektrische Verbindungen geprüft",
  "Fehlerspeicher ausgelesen",
  "Druckprüfung durchgeführt",
  "Kunden-Unterschrift eingeholt",
];

export function CompleteVisitButton({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHECKS.map((c) => [c, true])),
  );
  const [issues, setIssues] = useState("");
  const [followUp, setFollowUp] = useState(false);

  const complete = trpc.maintenance.completeVisit.useMutation({
    onSuccess: () => {
      toast.success("Wartungstermin abgeschlossen");
      setOpen(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const checkedItems = DEFAULT_CHECKS.filter((c) => checks[c]);
    complete.mutate({
      id: visitId,
      protocol: { checks: checkedItems, signature: true },
      issuesFound: issues || undefined,
      followUpRequired: followUp,
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-4" /> Wartung abschließen
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <header className="sticky top-0 bg-card z-10 flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="font-semibold">Wartungsprotokoll</h2>
              <button onClick={() => setOpen(false)} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg">
                <X className="size-4" />
              </button>
            </header>

            <form onSubmit={submit} className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Prüfpunkte</div>
                {DEFAULT_CHECKS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checks[c] ?? false}
                      onChange={(e) => setChecks({ ...checks, [c]: e.target.checked })}
                    />
                    {c}
                  </label>
                ))}
              </div>

              <Field label="Gefundene Mängel (optional)">
                <Textarea rows={3} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="z.B. Kältemittel-Druck etwas niedrig, Soledichte prüfen beim nächsten Termin" />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
                Folgeauftrag erforderlich
              </label>

              <p className="text-xs text-muted-fg">
                Bei Abschluss wird automatisch der nächste Termin in {"{intervalMonths}"} Monaten erzeugt.
              </p>

              <footer className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button type="submit" disabled={complete.isPending}>
                  {complete.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Abschließen
                </Button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

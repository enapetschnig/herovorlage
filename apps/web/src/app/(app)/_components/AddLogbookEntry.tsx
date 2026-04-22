"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Textarea } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Loader2, MessageSquarePlus } from "lucide-react";

const KIND_OPTIONS = [
  { value: "note", label: "Notiz" },
  { value: "call", label: "Anruf" },
  { value: "email", label: "E-Mail" },
  { value: "event", label: "Ereignis" },
] as const;

export function AddLogbookEntry({
  entityType, entityId,
}: {
  entityType: "project" | "contact" | "document";
  entityId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<typeof KIND_OPTIONS[number]["value"]>("note");
  const [message, setMessage] = useState("");
  const add = trpc.logbook.add.useMutation();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 1) return;
    add.mutate(
      { entityType, entityId, kind, message: message.trim() },
      {
        onSuccess: () => {
          toast.success("Logbuch-Eintrag hinzugefügt");
          setMessage("");
          setOpen(false);
          router.refresh();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" /> Eintrag hinzufügen
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="border border-border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Neuer Eintrag</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="h-8 text-xs px-2 rounded border border-input bg-bg"
        >
          {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <Field>
        <Textarea
          autoFocus rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Was ist passiert? Was wurde besprochen?"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setMessage(""); }}>Abbrechen</Button>
        <Button type="submit" size="sm" disabled={add.isPending || message.trim().length === 0}>
          {add.isPending ? <Loader2 className="size-4 animate-spin" /> : "Speichern"}
        </Button>
      </div>
    </form>
  );
}

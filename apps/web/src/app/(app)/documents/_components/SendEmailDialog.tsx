"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Loader2, Send, X } from "lucide-react";

export function SendEmailDialog({
  open, onClose, documentId, defaultTo,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("Ihr Dokument {{Document.number}} von {{Company.name}}");
  const [body, setBody] = useState(
    `Sehr geehrte/r {{Contact.salutation}} {{Contact.lastName}},\n\n` +
      `im Anhang finden Sie {{Document.number}}.\n` +
      `Bei Fragen melden Sie sich gerne.\n\n` +
      `Mit besten Grüßen\n{{User.name}}\n{{Company.name}}`,
  );
  const [attachXml, setAttachXml] = useState(false);

  const send = trpc.documents.sendByEmail.useMutation({
    onSuccess: () => {
      toast.success("E-Mail versendet");
      onClose();
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => { setTo(defaultTo); }, [defaultTo]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    send.mutate({
      id: documentId,
      to,
      cc: cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
      subject,
      body,
      attachXml,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div ref={dialogRef} className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold">Dokument per E-Mail senden</h2>
          <button onClick={onClose} aria-label="Schließen" className="p-1 rounded hover:bg-muted text-muted-fg">
            <X className="size-4" />
          </button>
        </header>

        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="An" htmlFor="se-to" required>
            <Input id="se-to" type="email" required value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="CC (komma-getrennt)" htmlFor="se-cc">
            <Input id="se-cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional@example.com, …" />
          </Field>
          <Field label="Betreff" htmlFor="se-subject" hint="Mustache-Platzhalter wie {{Document.number}} werden ersetzt.">
            <Input id="se-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Nachricht" htmlFor="se-body">
            <Textarea id="se-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={attachXml} onChange={(e) => setAttachXml(e.target.checked)} />
            Zusätzlich XRechnung-XML anhängen
          </label>
          <p className="text-xs text-muted-fg">
            PDF wird automatisch generiert und angehängt. Versand über SMTP (Mailpit lokal auf Port 1025 — Web-UI unter <code>:8025</code>).
          </p>

          <footer className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={send.isPending || !to}>
              {send.isPending ? <><Loader2 className="size-4 animate-spin" /> Sende…</> : <><Send className="size-4" /> Senden</>}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

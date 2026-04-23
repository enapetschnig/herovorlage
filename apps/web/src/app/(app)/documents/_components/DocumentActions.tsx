"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Copy, Download, Eye, FileCheck2, FileCode, Loader2, Lock, Send } from "lucide-react";
import { SendEmailDialog } from "./SendEmailDialog";

export function DocumentActions({
  docId, type, locked, contactEmail,
}: {
  docId: string;
  type: string;
  locked: boolean;
  contactEmail: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  const finalize = trpc.documents.finalize.useMutation({
    onSuccess: () => { toast.success("Dokument abgeschlossen"); router.refresh(); },
    onError: (e) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const clone = trpc.documents.clone.useMutation({
    onSuccess: ({ id, number }) => { toast.success(`Kopiert als ${number}`); router.push(`/documents/${id}`); },
    onError: (e) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  const canConvertToInvoice = type === "quote" || type === "order_confirmation";

  return (
    <>
      {/* Primary PDF actions — prominent */}
      <div className="inline-flex rounded-md border border-border bg-card shadow-xs overflow-hidden">
        <a
          href={`/api/documents/${docId}/pdf`}
          target="_blank"
          rel="noopener"
          title="PDF in neuem Tab öffnen"
          className="h-9 px-3 inline-flex items-center gap-1.5 text-sm font-medium text-fg hover:bg-muted transition-colors border-r border-border"
        >
          <Eye className="size-4" /> PDF öffnen
        </a>
        <a
          href={`/api/documents/${docId}/pdf?download=1`}
          title="PDF herunterladen"
          className="h-9 px-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Download className="size-4" /> PDF
        </a>
      </div>

      <a href={`/api/documents/${docId}/xml`}>
        <Button variant="ghost" size="md" type="button" title="XRechnung-XML (EN 16931) herunterladen">
          <FileCode className="size-4" /> XRechnung
        </Button>
      </a>

      {!locked && (
        <Button
          variant="secondary" size="md"
          onClick={() => setSendOpen(true)}
          disabled={!contactEmail}
          title={contactEmail ? "Per E-Mail senden" : "Kontakt hat keine E-Mail"}
        >
          <Send className="size-4" /> Versenden
        </Button>
      )}

      {canConvertToInvoice && !locked && (
        <Button variant="secondary" size="md"
          disabled={pending !== null}
          onClick={() => { setPending("invoice"); clone.mutate({ id: docId, newType: "invoice" }); }}
        >
          <FileCheck2 className="size-4" /> Als Rechnung
        </Button>
      )}
      <Button variant="ghost" size="md"
        disabled={pending !== null}
        onClick={() => { setPending("clone"); clone.mutate({ id: docId }); }}
        title="Dokument kopieren"
      >
        {pending === "clone" ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
      </Button>

      {!locked && (
        <Button variant="primary" size="md"
          disabled={pending !== null}
          onClick={() => {
            if (!confirm("Dokument wirklich abschließen? Danach ist es unveränderbar (GoBD).")) return;
            setPending("finalize");
            finalize.mutate({ id: docId });
          }}
        >
          <Lock className="size-4" /> Abschließen
        </Button>
      )}

      <SendEmailDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        documentId={docId}
        defaultTo={contactEmail ?? ""}
      />
    </>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heatflow/ui";
import { trpc } from "@/lib/trpc-client";
import { toast } from "sonner";
import { Copy, Download, FileCheck2, FileCode, Loader2, Lock, Send } from "lucide-react";
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
      <a href={`/api/documents/${docId}/pdf`} target="_blank" rel="noopener">
        <Button variant="ghost" size="sm" type="button" title="PDF in neuem Tab öffnen">
          <Download className="size-4" /> PDF
        </Button>
      </a>
      <a href={`/api/documents/${docId}/xml`}>
        <Button variant="ghost" size="sm" type="button" title="XRechnung-XML herunterladen">
          <FileCode className="size-4" /> XRechnung
        </Button>
      </a>

      {!locked && (
        <Button
          variant="secondary" size="sm"
          onClick={() => setSendOpen(true)}
          disabled={!contactEmail}
          title={contactEmail ? "Per E-Mail senden" : "Kontakt hat keine E-Mail"}
        >
          <Send className="size-4" /> Versenden
        </Button>
      )}

      {canConvertToInvoice && !locked && (
        <Button variant="secondary" size="sm"
          disabled={pending !== null}
          onClick={() => { setPending("invoice"); clone.mutate({ id: docId, newType: "invoice" }); }}
        >
          <FileCheck2 className="size-4" /> Als Rechnung
        </Button>
      )}
      <Button variant="ghost" size="sm"
        disabled={pending !== null}
        onClick={() => { setPending("clone"); clone.mutate({ id: docId }); }}
      >
        {pending === "clone" ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} Kopie
      </Button>

      {!locked && (
        <Button variant="primary" size="sm"
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

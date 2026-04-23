"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CheckCircle2, Download, Eye, X } from "lucide-react";

/**
 * Shown when a user lands on a document detail page with `?created=1` — offers
 * one-click PDF download/preview right after creation.
 */
export function CreatedBanner({ docId, number }: { docId: string; number: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(sp.get("created") === "1");

  useEffect(() => {
    if (sp.get("created") === "1") {
      setVisible(true);
    }
  }, [sp]);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    router.replace(pathname);
  }

  return (
    <div className="mb-4 rounded-xl border border-success/30 bg-success/5 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
      <div className="size-10 rounded-full bg-success/15 grid place-items-center flex-shrink-0">
        <CheckCircle2 className="size-5 text-success" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Dokument {number} wurde erstellt.</div>
        <div className="text-sm text-muted-fg mt-0.5">Du kannst jetzt die PDF öffnen, herunterladen oder direkt an den Kunden senden.</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={`/api/documents/${docId}/pdf?download=1`}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 text-sm font-medium rounded-md bg-primary text-primary-fg shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Download className="size-4" /> PDF herunterladen
          </a>
          <a
            href={`/api/documents/${docId}/pdf`}
            target="_blank"
            rel="noopener"
            className="h-9 px-3.5 inline-flex items-center gap-1.5 text-sm font-medium rounded-md border border-border bg-card hover:bg-muted transition-colors"
          >
            <Eye className="size-4" /> Vorschau öffnen
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="p-1.5 rounded-md text-muted-fg hover:bg-muted hover:text-fg transition-colors"
        aria-label="Banner schließen"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, FileText, Loader2, Package, Search, Users, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

type Result = { id: string; type: "contact" | "project" | "article" | "document"; label: string; sub: string | null };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = trpc.search.global.useQuery(
    { q: q.trim(), limit: 6 },
    { enabled: open && q.trim().length >= 2, staleTime: 0 },
  );

  const flat: Result[] = [];
  if (search.data) {
    for (const c of search.data.contacts) flat.push({ id: c.id, type: "contact", label: c.label, sub: c.sub });
    for (const p of search.data.projects) flat.push({ id: p.id, type: "project", label: p.label, sub: p.sub });
    for (const a of search.data.articles) flat.push({ id: a.id, type: "article", label: a.label, sub: a.sub });
    for (const d of search.data.documents) flat.push({ id: d.id, type: "document", label: d.label ?? "(ohne Titel)", sub: d.sub });
  }

  const navigate = useCallback((r: Result) => {
    onClose();
    setQ("");
    if (r.type === "contact") router.push(`/contacts/${r.id}`);
    else if (r.type === "project") router.push(`/projects/${r.id}`);
    else if (r.type === "document") router.push(`/documents/${r.id}`);
    else if (r.type === "article") router.push(`/articles?q=${encodeURIComponent(r.label)}`);
  }, [onClose, router]);

  useEffect(() => {
    if (open) {
      setActiveIdx(0);
      // focus on next tick
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, Math.max(0, flat.length - 1))); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
      if (e.key === "Enter" && flat[activeIdx]) { e.preventDefault(); navigate(flat[activeIdx]); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, activeIdx, navigate, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-w-xl mx-auto mt-24 bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3 h-12">
          <Search className="size-4 text-muted-fg flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kontakte, Projekte, Artikel, Dokumente suchen…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-fg"
          />
          {search.isFetching && <Loader2 className="size-4 animate-spin text-muted-fg" />}
          <button onClick={onClose} className="text-muted-fg hover:text-fg p-1" aria-label="Schließen">
            <X className="size-4" />
          </button>
        </div>

        <ul className="max-h-96 overflow-y-auto">
          {q.trim().length < 2 && (
            <li className="px-4 py-8 text-center text-sm text-muted-fg">
              Mindestens 2 Zeichen eingeben…
            </li>
          )}
          {q.trim().length >= 2 && search.isSuccess && flat.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-fg">
              Nichts gefunden für „{q}".
            </li>
          )}
          {flat.map((r, i) => (
            <li key={`${r.type}_${r.id}`}>
              <button
                onClick={() => navigate(r)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm border-b border-border last:border-0 ${
                  i === activeIdx ? "bg-primary/10" : "hover:bg-muted/40"
                }`}
              >
                <ResultIcon type={r.type} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.label}</div>
                  {r.sub && <div className="text-xs text-muted-fg truncate">{r.sub}</div>}
                </div>
                <span className="text-xs text-muted-fg uppercase tracking-wide">{TYPE_LABEL[r.type]}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-3 py-2 text-xs text-muted-fg flex justify-between">
          <span>↑↓ Navigieren · Enter Öffnen · Esc Schließen</span>
          <span>HeatFlow</span>
        </div>
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<Result["type"], string> = {
  contact: "Kontakt", project: "Projekt", article: "Artikel", document: "Dokument",
};

function ResultIcon({ type }: { type: Result["type"] }) {
  const cls = "size-4 text-muted-fg flex-shrink-0";
  if (type === "contact") return <Users className={cls} />;
  if (type === "project") return <Briefcase className={cls} />;
  if (type === "article") return <Package className={cls} />;
  return <FileText className={cls} />;
}

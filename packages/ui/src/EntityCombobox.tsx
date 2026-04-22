"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "./cn";

export type ComboboxOption = { id: string; label: string; sub?: string };

export type EntityComboboxProps = {
  value: string | null | undefined;
  onChange: (id: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  /** When provided, shows a "+ Neu …" affordance that calls this with the current input. */
  onCreateNew?: (query: string) => void;
  newLabel?: string;
  disabled?: boolean;
  className?: string;
  loading?: boolean;
  /** If provided, entries are filtered server-side: typing fires this for live search. */
  onSearch?: (query: string) => void;
};

/**
 * Searchable single-select with optional inline-create. Uses native focus/blur
 * for accessibility — no portal, no global popper machinery.
 */
export function EntityCombobox({
  value, onChange, options, placeholder = "Auswählen…",
  onCreateNew, newLabel = "Neu anlegen", disabled, className, loading, onSearch,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = onSearch
    ? options
    : options.filter((o) =>
        query.trim() === ""
          ? true
          : o.label.toLowerCase().includes(query.toLowerCase()) ||
            (o.sub ?? "").toLowerCase().includes(query.toLowerCase()),
      );

  // close on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      window.addEventListener("mousedown", onDocClick);
      setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  useEffect(() => { if (onSearch) onSearch(query); }, [query, onSearch]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) { onChange(opt.id); setOpen(false); setQuery(""); }
      else if (onCreateNew && query.trim()) { onCreateNew(query.trim()); setOpen(false); setQuery(""); }
    }
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded border border-input bg-bg px-3 py-1 text-sm text-left transition-colors",
          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          !selected && "text-muted-fg",
        )}
      >
        <span className="truncate flex-1">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn("size-4 text-muted-fg transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-card border border-border rounded shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-2 h-9">
            <Search className="size-4 text-muted-fg" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={onKey}
              placeholder="Suchen…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-fg" />}
            {query && (
              <button onClick={() => setQuery("")} className="p-1 text-muted-fg" aria-label="leeren">
                <X className="size-3" />
              </button>
            )}
          </div>

          <ul className="max-h-72 overflow-y-auto" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-fg text-center">
                Keine Treffer{onCreateNew && query.trim() && " — Enter drücken, um neu anzulegen."}
              </li>
            )}
            {filtered.map((opt, i) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => { onChange(opt.id); setOpen(false); setQuery(""); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm flex flex-col",
                    i === activeIdx ? "bg-primary/10" : "hover:bg-muted/30",
                    opt.id === value && "font-medium",
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.sub && <span className="text-xs text-muted-fg truncate">{opt.sub}</span>}
                </button>
              </li>
            ))}
          </ul>

          {onCreateNew && (
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => { onCreateNew(query.trim()); setOpen(false); setQuery(""); }}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-primary hover:bg-primary/5"
              >
                <Plus className="size-4" /> {newLabel}{query.trim() && `: „${query.trim()}"`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

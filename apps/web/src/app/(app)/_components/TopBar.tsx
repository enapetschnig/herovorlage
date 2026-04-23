"use client";
import { Bell, Search, Sparkles } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm px-4 flex items-center gap-3 sticky top-0 z-10">
      <div className="flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("heatflow:open-palette"))}
          className="w-full h-9 px-3 flex items-center gap-2 rounded-lg border border-border bg-bg/50 text-sm text-muted-fg hover:bg-muted/50 hover:border-border/80 transition-colors"
          aria-label="Globale Suche öffnen (Cmd+K)"
        >
          <Search className="size-4 flex-shrink-0" />
          <span className="flex-1 text-left">Kontakte, Projekte, Artikel suchen…</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-card border border-border text-muted-fg">⌘K</kbd>
        </button>
      </div>

      <button
        type="button"
        aria-label="FlowAI Assistent öffnen (Cmd+.)"
        title="FlowAI Assistent (⌘.)"
        onClick={() => window.dispatchEvent(new Event("heatflow:open-assistant"))}
        className="h-9 w-9 grid place-items-center rounded-lg text-muted-fg hover:bg-muted hover:text-accent transition-colors"
      >
        <Sparkles className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Benachrichtigungen"
        className="h-9 w-9 grid place-items-center rounded-lg text-muted-fg hover:bg-muted hover:text-fg transition-colors relative"
      >
        <Bell className="size-4" />
        <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent" />
      </button>
    </header>
  );
}

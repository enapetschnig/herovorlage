"use client";
import { useState, type ReactNode } from "react";
import { cn } from "./cn";

export type TabItem = { id: string; label: string; badge?: ReactNode; content: ReactNode };

export function Tabs({ items, defaultId, className }: { items: TabItem[]; defaultId?: string; className?: string }) {
  const [activeId, setActiveId] = useState(defaultId ?? items[0]?.id);
  const active = items.find((i) => i.id === activeId);
  return (
    <div className={className}>
      <div className="border-b border-border bg-card overflow-x-auto">
        <nav className="flex gap-0 px-2" role="tablist">
          {items.map((it) => {
            const isActive = it.id === activeId;
            return (
              <button
                key={it.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(it.id)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-fg hover:text-fg hover:border-border",
                )}
              >
                {it.label}
                {it.badge}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="p-6">{active?.content}</div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "./cn";

export function PageHeader({
  title, description, actions, children, className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border bg-card/60 backdrop-blur-sm", className)}>
      <div className="px-6 py-6 max-w-7xl mx-auto flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {description && <p className="text-sm text-muted-fg mt-1 leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {children && <div className="px-6 pb-4 max-w-7xl mx-auto">{children}</div>}
    </div>
  );
}

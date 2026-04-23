import type { ReactNode } from "react";
import { cn } from "./cn";

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-14 px-6 gap-4", className)}>
      {icon && (
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" aria-hidden="true" />
          <div className="relative size-14 rounded-2xl bg-muted ring-1 ring-border grid place-items-center text-muted-fg">
            {icon}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-sm text-muted-fg max-w-md leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

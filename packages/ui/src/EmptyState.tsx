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
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6 gap-3", className)}>
      {icon && <div className="size-12 rounded-full bg-muted grid place-items-center text-muted-fg">{icon}</div>}
      <div>
        <h3 className="text-base font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-fg mt-1 max-w-md">{description}</p>}
      </div>
      {action}
    </div>
  );
}

import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badgeStyles = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-fg ring-border",
        primary: "bg-primary/10 text-primary ring-primary/20",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning ring-warning/30",
        danger: "bg-danger/10 text-danger ring-danger/20",
        accent: "bg-accent/15 text-accent-fg ring-accent/30",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>;
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

const STATUS_TONES: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "accent"> = {
  lead: "neutral",
  quoted: "primary",
  accepted: "primary",
  scheduled: "accent",
  in_progress: "warning",
  completed: "success",
  invoiced: "primary",
  paid: "success",
  cancelled: "danger",
  draft: "neutral",
  sent: "primary",
  rejected: "danger",
  overdue: "danger",
};
const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  quoted: "Angebot",
  accepted: "Angenommen",
  scheduled: "Geplant",
  in_progress: "In Arbeit",
  completed: "Fertig",
  invoiced: "Fakturiert",
  paid: "Bezahlt",
  cancelled: "Storniert",
  draft: "Entwurf",
  sent: "Versendet",
  rejected: "Abgelehnt",
  overdue: "Überfällig",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? "neutral";
  const label = STATUS_LABELS[status] ?? status;
  return <Badge tone={tone} className={className}>{label}</Badge>;
}

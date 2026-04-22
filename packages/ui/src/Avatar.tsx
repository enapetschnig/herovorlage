import { cn } from "./cn";

export function Avatar({ name, src, size = 32, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        width={size}
        height={size}
        className={cn("rounded-full object-cover ring-1 ring-border", className)}
      />
    );
  }
  return (
    <div
      className={cn("rounded-full bg-primary/10 text-primary font-medium grid place-items-center ring-1 ring-primary/20", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </div>
  );
}

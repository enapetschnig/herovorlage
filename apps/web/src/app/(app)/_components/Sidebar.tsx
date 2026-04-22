"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, cn } from "@heatflow/ui";
import {
  LayoutDashboard, Users, Briefcase, FileText, Package, Clock, CheckSquare,
  CalendarDays, Wrench, FileSpreadsheet, Sparkles, Settings, LogOut, Flame, AlertCircle, Warehouse, ListChecks,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
};

const NAV: NavItem[] = [
  { href: "/dashboard",   label: "Übersicht",  icon: LayoutDashboard,  group: "Start" },
  { href: "/contacts",    label: "Kontakte",   icon: Users,            group: "CRM" },
  { href: "/projects",    label: "Projekte",   icon: Briefcase,        group: "CRM" },
  { href: "/tasks",       label: "Aufgaben",   icon: CheckSquare,      group: "CRM" },
  { href: "/documents",   label: "Dokumente",  icon: FileText,         group: "Belege" },
  { href: "/articles",    label: "Artikel",    icon: Package,          group: "Belege" },
  { href: "/time",        label: "Zeit",       icon: Clock,            group: "Operativ" },
  { href: "/schedule",    label: "Plantafel",  icon: CalendarDays,     group: "Operativ" },
  { href: "/maintenance", label: "Wartung",    icon: Wrench,           group: "Module" },
  { href: "/warehouse",   label: "Lager",      icon: Warehouse,        group: "Module" },
  { href: "/funding",     label: "Förderung",  icon: FileSpreadsheet,  group: "Module" },
  { href: "/reminders",   label: "Mahnwesen",  icon: AlertCircle,      group: "Module" },
  { href: "/checklists",  label: "Checklisten", icon: ListChecks,      group: "Module" },
  { href: "/flowai",      label: "FlowAI",     icon: Sparkles,         group: "Module" },
  { href: "/settings",    label: "Einstellungen", icon: Settings,      group: "System" },
];

export function Sidebar({
  user,
  signOut,
}: {
  user: { name: string; email: string; role: string };
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  // Group items
  const groups: Record<string, NavItem[]> = {};
  for (const item of NAV) {
    const g = item.group ?? "";
    (groups[g] ??= []).push(item);
  }

  return (
    <aside className="row-span-2 border-r border-border bg-card flex flex-col min-h-screen">
      <div className="px-5 h-14 flex items-center gap-2.5 border-b border-border">
        <div className="size-8 rounded-md bg-primary text-primary-fg grid place-items-center">
          <Flame className="size-4.5" />
        </div>
        <span className="text-base font-semibold tracking-tight">HeatFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="px-2 text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5">
              {group}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-2.5 py-2 rounded text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-fg hover:bg-muted",
                      )}
                    >
                      <Icon className="size-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <form action={signOut} className="border-t border-border p-3 flex items-center gap-3">
        <Avatar name={user.name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{user.name}</div>
          <div className="text-xs text-muted-fg truncate capitalize">{user.role}</div>
        </div>
        <button
          type="submit"
          aria-label="Abmelden"
          className="p-2 rounded hover:bg-muted text-muted-fg hover:text-fg transition-colors"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </aside>
  );
}

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
  { href: "/dashboard",   label: "Übersicht",     icon: LayoutDashboard,  group: "Start" },
  { href: "/contacts",    label: "Kontakte",      icon: Users,            group: "CRM" },
  { href: "/projects",    label: "Projekte",      icon: Briefcase,        group: "CRM" },
  { href: "/tasks",       label: "Aufgaben",      icon: CheckSquare,      group: "CRM" },
  { href: "/documents",   label: "Dokumente",     icon: FileText,         group: "Belege" },
  { href: "/articles",    label: "Artikel",       icon: Package,          group: "Belege" },
  { href: "/time",        label: "Zeit",          icon: Clock,            group: "Operativ" },
  { href: "/schedule",    label: "Plantafel",     icon: CalendarDays,     group: "Operativ" },
  { href: "/maintenance", label: "Wartung",       icon: Wrench,           group: "Module" },
  { href: "/warehouse",   label: "Lager",         icon: Warehouse,        group: "Module" },
  { href: "/funding",     label: "Förderung",     icon: FileSpreadsheet,  group: "Module" },
  { href: "/reminders",   label: "Mahnwesen",     icon: AlertCircle,      group: "Module" },
  { href: "/checklists",  label: "Checklisten",   icon: ListChecks,       group: "Module" },
  { href: "/flowai",      label: "FlowAI",        icon: Sparkles,         group: "Module" },
  { href: "/settings",    label: "Einstellungen", icon: Settings,         group: "System" },
];

export function Sidebar({
  user,
  signOut,
}: {
  user: { name: string; email: string; role: string };
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  const groups: Record<string, NavItem[]> = {};
  for (const item of NAV) {
    const g = item.group ?? "";
    (groups[g] ??= []).push(item);
  }

  return (
    <aside className="row-span-2 border-r border-border bg-card flex flex-col min-h-screen">
      {/* Brand */}
      <div className="px-4 h-14 flex items-center gap-2.5 border-b border-border">
        <div className="size-8 rounded-lg bg-gradient-brand text-primary-fg grid place-items-center shadow-sm">
          <Flame className="size-4" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-tight leading-none">HeatFlow</div>
          <div className="text-[10px] text-muted-fg mt-0.5 tracking-wider uppercase">v1.0 · Demo</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="px-2.5 text-[10px] font-semibold text-muted-fg uppercase tracking-[0.08em] mb-1.5">
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
                        "group relative flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-md text-sm font-medium transition-all",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-fg/85 hover:text-fg hover:bg-muted",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <Icon
                        className={cn(
                          "size-4 flex-shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-fg group-hover:text-fg",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User / Sign out */}
      <form action={signOut} className="border-t border-border p-3 flex items-center gap-2.5">
        <Avatar name={user.name} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate leading-tight">{user.name}</div>
          <div className="text-[11px] text-muted-fg truncate capitalize leading-tight mt-0.5">{user.role}</div>
        </div>
        <button
          type="submit"
          aria-label="Abmelden"
          title="Abmelden"
          className="p-2 rounded-md hover:bg-muted text-muted-fg hover:text-danger transition-colors"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </aside>
  );
}

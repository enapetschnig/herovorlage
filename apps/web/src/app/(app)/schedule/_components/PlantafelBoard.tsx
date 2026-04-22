"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { trpc } from "@/lib/trpc-client";
import { Avatar, Badge, Button, Card } from "@heatflow/ui";
import { ChevronLeft, ChevronRight, Wrench, CheckSquare, GripVertical } from "lucide-react";
import { toast } from "sonner";

type Slot = {
  id: string;
  kind: "task" | "maintenance";
  title: string;
  date: string;
  userId: string | null;
  sub: string | null;
  priority?: string | null;
  status?: string | null;
  completed?: boolean;
  href: string;
};

type Member = { id: string; name: string; role: string };

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function PlantafelBoard({
  weekStart, initialMembers, initialSlots,
}: {
  weekStart: string;
  initialMembers: Member[];
  initialSlots: Slot[];
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { setSlots(initialSlots); }, [initialSlots]);

  const move = trpc.schedule.moveSlot.useMutation({
    onError: (e) => { toast.error(e.message); router.refresh(); },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Build 14-day list
  const days = useMemo(() => {
    const out: { date: string; label: string; isToday: boolean; isWeekend: boolean }[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 14; i++) {
      const d = new Date(weekStart + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dow = (d.getUTCDay() + 6) % 7; // 0=Mon
      out.push({
        date: iso,
        label: `${DAY_LABELS[dow]} ${d.getUTCDate()}.${(d.getUTCMonth() + 1).toString().padStart(2, "0")}`,
        isToday: iso === today,
        isWeekend: dow >= 5,
      });
    }
    return out;
  }, [weekStart]);

  // Add a synthetic "Unassigned" row at the top
  const rows = useMemo(() => [
    { id: "__unassigned__", name: "Unzugewiesen", role: "" } as Member,
    ...initialMembers,
  ], [initialMembers]);

  const slotsByCell = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = `${s.userId ?? "__unassigned__"}|${s.date}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [slots]);

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    if (!e.over) return;
    const slot = e.active.data.current as { slot: Slot } | undefined;
    if (!slot) return;
    const cellId = String(e.over.id); // format: userId|date
    const [toUserRaw, toDate] = cellId.split("|");
    const toUserId = toUserRaw === "__unassigned__" ? null : toUserRaw ?? null;
    if (slot.slot.userId === toUserId && slot.slot.date === toDate) return;

    // Optimistic update
    setSlots((prev) => prev.map((s) => s.id === slot.slot.id ? { ...s, userId: toUserId, date: toDate ?? s.date } : s));

    move.mutate(
      { kind: slot.slot.kind, id: slot.slot.id, toUserId, toDate: toDate ?? slot.slot.date },
      { onSuccess: () => toast.success("Verschoben") },
    );
  };

  const goWeek = (delta: number) => {
    const d = new Date(weekStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta * 7);
    router.push(`/schedule?week=${d.toISOString().slice(0, 10)}`);
  };

  const draggingSlot = draggingId ? slots.find((s) => s.id === draggingId) ?? null : null;

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => goWeek(-1)} aria-label="vorherige Woche"><ChevronLeft className="size-4" /></Button>
        <div className="text-sm font-medium tabular-nums">{days[0]?.date} – {days[13]?.date}</div>
        <Button variant="ghost" size="icon" onClick={() => goWeek(1)} aria-label="nächste Woche"><ChevronRight className="size-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/schedule`)}>Diese Woche</Button>
        <div className="ml-auto text-xs text-muted-fg">
          {slots.length} Termine in 14 Tagen
        </div>
      </div>

      {/* Grid */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="border border-border rounded-lg bg-card overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2 border-r border-border min-w-[160px] sticky left-0 bg-muted/50 z-20">Mitarbeiter</th>
                {days.map((d) => (
                  <th key={d.date} className={`text-left p-2 border-r border-border last:border-r-0 min-w-[140px] ${d.isToday ? "bg-primary/10" : d.isWeekend ? "bg-muted" : ""}`}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="p-2 border-r border-border align-top sticky left-0 bg-card z-10 min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} size={28} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{m.name}</div>
                        {m.role && <div className="text-[10px] text-muted-fg uppercase">{m.role}</div>}
                      </div>
                    </div>
                  </td>
                  {days.map((d) => (
                    <Cell
                      key={d.date}
                      cellId={`${m.id}|${d.date}`}
                      slots={slotsByCell.get(`${m.id}|${d.date}`) ?? []}
                      isWeekend={d.isWeekend}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {draggingSlot ? <SlotChip slot={draggingSlot} dragging /> : null}
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-muted-fg">
        💡 Aufgaben werden aus <Link href="/tasks" className="underline hover:text-primary">/tasks</Link> + Projekten gezogen.
        Wartungstermine kommen aus <Link href="/maintenance" className="underline hover:text-primary">/maintenance</Link>.
        Nur offene Aufgaben (open/in_progress) erscheinen hier.
      </p>
    </div>
  );
}

function Cell({ cellId, slots, isWeekend }: { cellId: string; slots: Slot[]; isWeekend: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });
  return (
    <td
      ref={setNodeRef}
      className={`p-1.5 border-r border-border last:border-r-0 align-top min-w-[140px] min-h-[80px] transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/40 ring-inset" : isWeekend ? "bg-muted/30" : ""
      }`}
    >
      <div className="space-y-1 min-h-[60px]">
        {slots.map((s) => <DraggableChip key={`${s.kind}-${s.id}`} slot={s} />)}
      </div>
    </td>
  );
}

function DraggableChip({ slot }: { slot: Slot }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${slot.kind}-${slot.id}`,
    data: { slot },
  });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? "opacity-30" : ""}>
      <SlotChip slot={slot} />
    </div>
  );
}

function SlotChip({ slot, dragging }: { slot: Slot; dragging?: boolean }) {
  const isUrgent = slot.priority === "urgent";
  const isHigh = slot.priority === "high";

  const colors = slot.kind === "maintenance"
    ? slot.completed
      ? "bg-success/10 text-success border-success/30"
      : "bg-warning/10 text-warning border-warning/30"
    : isUrgent
      ? "bg-danger/10 text-danger border-danger/30"
      : isHigh
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-primary/10 text-primary border-primary/20";

  return (
    <Card className={`p-1.5 cursor-grab text-xs border ${colors} ${dragging ? "shadow-lg ring-2 ring-primary cursor-grabbing" : ""}`}>
      <div className="flex items-start gap-1.5">
        <div className="flex-shrink-0 mt-0.5">
          {slot.kind === "maintenance" ? <Wrench className="size-3" /> : <CheckSquare className="size-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={slot.href}
            className="font-medium hover:underline block truncate text-[11px] leading-tight"
            onClick={(e) => e.stopPropagation()}
          >
            {slot.title}
          </Link>
          {slot.sub && <div className="text-[10px] text-muted-fg truncate">{slot.sub}</div>}
        </div>
        <GripVertical className="size-2.5 text-muted-fg flex-shrink-0" />
      </div>
    </Card>
  );
}

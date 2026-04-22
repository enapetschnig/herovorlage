"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { trpc } from "@/lib/trpc-client";
import { Badge, Card } from "@heatflow/ui";
import { formatMoney } from "@heatflow/utils";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";

type Card = {
  id: string;
  number: string;
  title: string;
  status: string;
  potentialValue: number;
  contactId: string;
  contactName: string | null;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  startDate: string | null;
  updatedAt: string | Date;
};

type Lane = {
  id: string;
  label: string;
  color: string;
  cards: Card[];
  valueSum: number;
};

export function KanbanBoard({ initialLanes }: { initialLanes: Lane[] }) {
  const router = useRouter();
  const [lanes, setLanes] = useState<Lane[]>(initialLanes);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { setLanes(initialLanes); }, [initialLanes]);

  const move = trpc.kanban.moveCard.useMutation({
    onError: (e) => {
      toast.error(e.message);
      // Revert by reloading from server
      router.refresh();
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const card = e.active.data.current as { card: Card } | undefined;
    const targetLane = e.over?.id ? String(e.over.id) : null;
    if (!card || !targetLane || card.card.status === targetLane) return;

    // Optimistic update
    setLanes((prev) => {
      const next: Lane[] = prev.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== card.card.id) }));
      const t = next.find((l) => l.id === targetLane);
      if (t) {
        t.cards = [{ ...card.card, status: targetLane }, ...t.cards];
      }
      // Recompute sums
      for (const l of next) l.valueSum = l.cards.reduce((s, c) => s + c.potentialValue, 0);
      return next;
    });

    // Persist
    move.mutate(
      { projectId: card.card.id, toStatus: targetLane as Card["status"] as never },
      {
        onSuccess: () => {
          toast.success(`„${card.card.title}" → ${lanes.find((l) => l.id === targetLane)?.label}`);
        },
      },
    );
  };

  const draggingCard: Card | null = draggingId
    ? lanes.flatMap((l) => l.cards).find((c) => c.id === draggingId) ?? null
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {lanes.map((lane) => (
          <KanbanLane key={lane.id} lane={lane} />
        ))}
      </div>

      <DragOverlay>
        {draggingCard ? <CardView card={draggingCard} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanLane({ lane }: { lane: Lane }) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id });
  return (
    <div className="flex-shrink-0 w-[280px]">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: lane.color }} />
          <span className="text-sm font-semibold">{lane.label}</span>
          <span className="text-xs text-muted-fg">{lane.cards.length}</span>
        </div>
        {lane.valueSum > 0 && (
          <span className="text-xs text-muted-fg tabular-nums">{formatMoney(lane.valueSum)}</span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[400px] rounded-lg p-2 space-y-2 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-muted/30"}`}
      >
        {lane.cards.length === 0 && (
          <div className="text-xs text-muted-fg text-center py-8">— leer —</div>
        )}
        {lane.cards.map((c) => (
          <DraggableCard key={c.id} card={c} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, data: { card } });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${isDragging ? "opacity-30" : ""}`}
    >
      <CardView card={card} />
    </div>
  );
}

function CardView({ card, dragging }: { card: Card; dragging?: boolean }) {
  return (
    <Card className={`p-3 ${dragging ? "shadow-lg ring-2 ring-primary cursor-grabbing" : "cursor-grab hover:border-primary/40"}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="size-3.5 text-muted-fg mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <code className="text-[10px] text-muted-fg">{card.number}</code>
            {card.potentialValue > 0 && <Badge tone="primary" className="text-[10px]">{formatMoney(card.potentialValue)}</Badge>}
          </div>
          <Link
            href={`/projects/${card.id}`}
            className="text-sm font-medium hover:underline block truncate mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {card.title}
          </Link>
          {card.contactName && (
            <div className="text-xs text-muted-fg truncate mt-0.5">{card.contactName}</div>
          )}
          {card.responsibleUserName && (
            <div className="text-xs text-muted-fg mt-1">→ {card.responsibleUserName}</div>
          )}
        </div>
      </div>
    </Card>
  );
}

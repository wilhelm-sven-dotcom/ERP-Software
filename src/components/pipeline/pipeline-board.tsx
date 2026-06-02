"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

import { moveProjectStatus } from "@/app/(app)/projekte/actions";
import { PROJECT_STATUSES } from "@/lib/constants";
import { customerName, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectWithCustomer } from "@/lib/data/projects";

const OTHER = "Sonstige";

export function PipelineBoard({
  projects,
}: {
  projects: ProjectWithCustomer[];
}) {
  const router = useRouter();
  const known = React.useMemo(() => new Set<string>(PROJECT_STATUSES), []);

  // Karten je Status-Spalte (lokal für optimistisches Verschieben).
  const [columns, setColumns] = React.useState<
    Record<string, ProjectWithCustomer[]>
  >(() => {
    const map: Record<string, ProjectWithCustomer[]> = { [OTHER]: [] };
    for (const st of PROJECT_STATUSES) map[st] = [];
    for (const p of projects) {
      const key = p.status && known.has(p.status) ? p.status : OTHER;
      map[key].push(p);
    }
    return map;
  });
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function findColumn(projectId: string): string | null {
    for (const [col, items] of Object.entries(columns)) {
      if (items.some((p) => p.id === projectId)) return col;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const from = findColumn(String(active.id));
    // over.id ist die Spalte (Status) oder eine Karte → deren Spalte ermitteln.
    const to = known.has(String(over.id))
      ? String(over.id)
      : findColumn(String(over.id));
    if (!from || !to || from === to || !known.has(to)) return;

    const card = columns[from].find((p) => p.id === active.id);
    if (!card) return;
    setColumns((prev) => ({
      ...prev,
      [from]: prev[from].filter((p) => p.id !== active.id),
      [to]: [{ ...card, status: to }, ...prev[to]],
    }));

    const res = await moveProjectStatus(String(active.id), to);
    if (!res.ok) {
      toast.error(res.error ?? "Status konnte nicht gespeichert werden");
      router.refresh();
    }
  }

  const allColumns = [...PROJECT_STATUSES, OTHER];
  const activeCard = activeId
    ? Object.values(columns).flat().find((p) => p.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {allColumns.map((status) => {
          const items = columns[status] ?? [];
          if (status === OTHER && items.length === 0) return null;
          return (
            <Column key={status} status={status} count={items.length}>
              {items.map((p) => (
                <Card key={p.id} project={p} />
              ))}
            </Column>
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? <CardShell project={activeCard} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  count,
  children,
}: {
  status: string;
  count: number;
  children: React.ReactNode;
}) {
  const droppable = status !== OTHER;
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !droppable });
  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border",
        isOver && "ring-primary ring-2",
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{status}</span>
        <span className="text-muted-foreground text-xs">{count}</span>
      </div>
      <div className="flex min-h-16 flex-col gap-2 p-2">
        {count === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-center text-xs">
            {droppable ? "Karten hierher ziehen" : "Keine Projekte"}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Card({ project }: { project: ProjectWithCustomer }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: project.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <CardShell project={project} />
    </div>
  );
}

function CardShell({
  project: p,
  dragging,
}: {
  project: ProjectWithCustomer;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-md border p-2.5 shadow-sm",
        dragging && "shadow-lg",
      )}
    >
      <Link
        href={`/projekte/${p.id}`}
        className="text-sm font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {p.title ?? "Ohne Titel"}
      </Link>
      <p className="text-muted-foreground mt-0.5 truncate text-xs">
        {p.customer ? customerName(p.customer) : "Kein Kunde"}
      </p>
      {p.system_size_kwp ? (
        <p className="text-muted-foreground text-xs">
          {formatNumber(p.system_size_kwp)} kWp
        </p>
      ) : null}
      {p.source || p.assignee?.name ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {p.source ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
              {p.source}
            </span>
          ) : null}
          {p.assignee?.name ? (
            <span className="text-muted-foreground text-[10px]">
              · {p.assignee.name}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
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
import { ProgressBar } from "@/components/projekte/progress-bar";
import { NewBadge } from "@/components/shared/new-badge";
import { SALES_STAGES, salesStageLabel } from "@/lib/constants";
import { customerName, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectWithCustomer } from "@/lib/data/projects";
import type { ProjectProgress } from "@/lib/data/workflow";

/**
 * Vertriebs-Board: zeigt nur Leads/Anfragen im Funnel (Neu → Kontaktiert →
 * Qualifiziert → Termin → Angebot). Karten per Drag & Drop weiterziehen; je
 * Karte „Gewonnen" (→ aktives Projekt, Status Auftrag) oder „Verloren". Damit
 * verlassen abgeschlossene Leads das Board — aktive Projekte leben unter Projekte.
 */
export function PipelineBoard({
  projects,
  progress = {},
}: {
  projects: ProjectWithCustomer[];
  progress?: Record<string, ProjectProgress>;
}) {
  const router = useRouter();
  const known = React.useMemo(() => new Set<string>(SALES_STAGES), []);

  // Karten je Stufe (lokal für optimistisches Verschieben). Nur Vertriebsstufen.
  const [columns, setColumns] = React.useState<Record<string, ProjectWithCustomer[]>>(() => {
    const map: Record<string, ProjectWithCustomer[]> = {};
    for (const st of SALES_STAGES) map[st] = [];
    for (const p of projects) {
      if (p.status && known.has(p.status)) map[p.status].push(p);
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
    const to = known.has(String(over.id)) ? String(over.id) : findColumn(String(over.id));
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

  // Lead abschließen: aus dem Board entfernen und Status setzen.
  async function closeLead(id: string, toStatus: "Auftrag" | "verloren") {
    const col = findColumn(id);
    if (col) setColumns((prev) => ({ ...prev, [col]: prev[col].filter((p) => p.id !== id) }));
    const res = await moveProjectStatus(id, toStatus);
    if (res.ok) {
      toast.success(toStatus === "Auftrag" ? "Lead gewonnen — als Projekt übernommen." : "Lead als verloren markiert.");
    } else {
      toast.error(res.error ?? "Konnte nicht gespeichert werden");
      router.refresh();
    }
  }

  const activeCard = activeId
    ? Object.values(columns).flat().find((p) => p.id === activeId)
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {SALES_STAGES.map((status) => {
          const items = columns[status] ?? [];
          return (
            <Column key={status} status={status} count={items.length}>
              {items.map((p) => (
                <Card key={p.id} project={p} prog={progress[p.id]} onClose={closeLead} />
              ))}
            </Column>
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? <CardShell project={activeCard} prog={progress[activeCard.id]} dragging /> : null}
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
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border",
        isOver && "ring-primary ring-2",
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{salesStageLabel(status)}</span>
        <span className="text-muted-foreground text-xs">{count}</span>
      </div>
      <div className="flex min-h-16 flex-col gap-2 p-2">
        {count === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-center text-xs">Karten hierher ziehen</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Card({
  project,
  prog,
  onClose,
}: {
  project: ProjectWithCustomer;
  prog?: ProjectProgress;
  onClose: (id: string, status: "Auftrag" | "verloren") => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: project.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <CardShell project={project} prog={prog} onClose={onClose} />
    </div>
  );
}

function CardShell({
  project: p,
  prog,
  dragging,
  onClose,
}: {
  project: ProjectWithCustomer;
  prog?: ProjectProgress;
  dragging?: boolean;
  onClose?: (id: string, status: "Auftrag" | "verloren") => void;
}) {
  return (
    <div className={cn("bg-card rounded-md border p-2.5 shadow-sm", dragging && "shadow-lg")}>
      <div className="flex items-center gap-2">
        <Link
          href={`/projekte/${p.id}`}
          className="text-sm font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {p.title ?? "Ohne Titel"}
        </Link>
        <NewBadge createdAt={p.created_at} />
      </div>
      <p className="text-muted-foreground mt-0.5 truncate text-xs">
        {p.customer ? customerName(p.customer) : "Kein Kunde"}
      </p>
      {p.system_size_kwp ? (
        <p className="text-muted-foreground text-xs">{formatNumber(p.system_size_kwp)} kWp</p>
      ) : null}
      {p.source || p.assignee?.name ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {p.source ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">{p.source}</span>
          ) : null}
          {p.assignee?.name ? (
            <span className="text-muted-foreground text-[10px]">· {p.assignee.name}</span>
          ) : null}
        </div>
      ) : null}
      {prog && prog.total > 0 ? (
        <ProgressBar done={prog.done} total={prog.total} overdue={prog.overdue} className="mt-2" />
      ) : null}
      {onClose ? (
        <div className="mt-2 flex items-center gap-1 border-t pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose(p.id, "Auftrag");
            }}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
          >
            <Check className="size-3" /> Gewonnen
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose(p.id, "verloren");
            }}
            className="text-muted-foreground hover:text-destructive inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-medium"
          >
            <X className="size-3" /> Verloren
          </button>
        </div>
      ) : null}
    </div>
  );
}

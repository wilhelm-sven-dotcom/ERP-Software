"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageSquare, Paperclip, Clock } from "lucide-react";
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

import { Button } from "@/components/ui/button";
import { ServiceCardDialog } from "@/components/service/service-card-dialog";
import { moveServiceTicket } from "@/app/(app)/service/actions";
import { SERVICE_STATUSES } from "@/lib/constants";
import { customerName, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ServiceTicketCard } from "@/lib/types";

type Person = { id: string; name: string };
type CustomerOpt = { id: string; name: string };

export function ServiceBoard({
  tickets,
  employees,
  customers,
}: {
  tickets: ServiceTicketCard[];
  employees: Person[];
  customers: CustomerOpt[];
}) {
  const router = useRouter();
  const [columns, setColumns] = React.useState<Record<string, ServiceTicketCard[]>>(() => {
    const map: Record<string, ServiceTicketCard[]> = {};
    for (const s of SERVICE_STATUSES) map[s] = [];
    for (const t of tickets) (map[t.status] ?? (map[t.status] = [])).push(t);
    return map;
  });
  React.useEffect(() => {
    const map: Record<string, ServiceTicketCard[]> = {};
    for (const s of SERVICE_STATUSES) map[s] = [];
    for (const t of tickets) (map[t.status] ?? (map[t.status] = [])).push(t);
    setColumns(map);
  }, [tickets]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? null;

  function findColumn(id: string): string | null {
    for (const [col, list] of Object.entries(columns)) if (list.some((t) => t.id === id)) return col;
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
    const to = (SERVICE_STATUSES as readonly string[]).includes(String(over.id))
      ? String(over.id)
      : findColumn(String(over.id));
    if (!from || !to || from === to) return;
    const card = columns[from].find((t) => t.id === active.id);
    if (!card) return;
    setColumns((prev) => ({
      ...prev,
      [from]: prev[from].filter((t) => t.id !== active.id),
      [to]: [{ ...card, status: to }, ...prev[to]],
    }));
    const res = await moveServiceTicket(String(active.id), to);
    if (!res.ok) {
      toast.error(res.error ?? "Konnte nicht verschieben");
      router.refresh();
    }
  }

  const activeCard = activeId
    ? Object.values(columns).flat().find((t) => t.id === activeId) ?? null
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {SERVICE_STATUSES.map((status) => (
          <Column key={status} status={status} count={columns[status]?.length ?? 0}>
            {(columns[status] ?? []).map((t) => (
              <ServiceCard
                key={t.id}
                ticket={t}
                assignee={empName(t.assignee_employee_id)}
                employees={employees}
                customers={customers}
              />
            ))}
            <ServiceCardDialog
              defaultStatus={status}
              employees={employees}
              customers={customers}
              trigger={
                <button className="text-muted-foreground hover:bg-muted/60 mt-1 flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm">
                  <Plus className="size-4" /> Karte
                </button>
              }
            />
          </Column>
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <CardShell ticket={activeCard} assignee={empName(activeCard.assignee_employee_id)} dragging />
        ) : null}
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
        "bg-muted/40 flex w-72 shrink-0 flex-col rounded-xl border",
        isOver && "ring-primary ring-2",
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{status}</span>
        <span className="text-muted-foreground text-xs">{count}</span>
      </div>
      <div className="flex min-h-16 flex-col gap-2 p-2">{children}</div>
    </div>
  );
}

function ServiceCard({
  ticket,
  assignee,
  employees,
  customers,
}: {
  ticket: ServiceTicketCard;
  assignee: string | null;
  employees: Person[];
  customers: CustomerOpt[];
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: ticket.id });
  return (
    <ServiceCardDialog
      ticket={ticket}
      employees={employees}
      customers={customers}
      trigger={
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className={cn("touch-none", isDragging && "opacity-40")}
        >
          <CardShell ticket={ticket} assignee={assignee} />
        </div>
      }
    />
  );
}

function CardShell({
  ticket,
  assignee,
  dragging,
}: {
  ticket: ServiceTicketCard;
  assignee: string | null;
  dragging?: boolean;
}) {
  const overdue =
    ticket.due_date != null &&
    ticket.status !== "Behoben" &&
    ticket.due_date < new Date().toISOString().slice(0, 10);
  return (
    <div className={cn("bg-card cursor-pointer overflow-hidden rounded-lg border shadow-sm", dragging && "shadow-lg")}>
      {ticket.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ticket.cover_url} alt="" className="h-28 w-full object-cover" />
      ) : null}
      <div className="p-2.5">
        <p className="text-sm font-medium">{ticket.title}</p>
        {ticket.customer || ticket.location ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {ticket.customer ? customerName(ticket.customer) : ""}
            {ticket.customer && ticket.location ? " · " : ""}
            {ticket.location ?? ""}
          </p>
        ) : null}
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {ticket.due_date ? (
            <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}>
              <Clock className="size-3.5" /> {formatDate(ticket.due_date)}
            </span>
          ) : null}
          {ticket.comment_count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" /> {ticket.comment_count}
            </span>
          ) : null}
          {ticket.file_count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3.5" /> {ticket.file_count}
            </span>
          ) : null}
          {assignee ? (
            <span className="bg-primary/10 text-primary ml-auto grid size-6 place-items-center rounded-full text-[10px] font-semibold" title={assignee}>
              {assignee
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

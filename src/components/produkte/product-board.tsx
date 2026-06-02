"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Search,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductFormDialog } from "@/components/produkte/product-form-dialog";
import { reorderGroups, reorderProducts } from "@/app/(app)/produkte/actions";
import { formatCurrency } from "@/lib/format";
import { productMatches } from "@/lib/search";
import { cn } from "@/lib/utils";
import type {
  Product,
  ProductAsset,
  ProductGroup,
  ProductWholesaler,
  Wholesaler,
} from "@/lib/types";

const NONE = "__none__";

type Thumbs = Record<string, string | null>;
type AssetsMap = Record<string, ProductAsset[]>;
type WholesalerLinks = Record<string, ProductWholesaler[]>;

type BoardEntry = { header?: string; product?: Product };

/**
 * Produktliste mit Kategorie-Zwischenüberschriften anreichern: vor dem ersten
 * Produkt einer Kategorie (bei Wechsel gegenüber dem vorigen) wird ein Header
 * eingeschoben. Die Produktreihenfolge selbst bleibt unverändert (DnD-kompatibel).
 */
function withSubHeaders(products: Product[]): BoardEntry[] {
  const out: BoardEntry[] = [];
  let last: string | null = null;
  for (const p of products) {
    const cat = p.category?.trim() || "Ohne Kategorie";
    if (cat !== last) {
      out.push({ header: cat });
      last = cat;
    }
    out.push({ product: p });
  }
  return out;
}

function SubHeader({ label }: { label: string }) {
  return (
    <div className="bg-muted/30 text-muted-foreground px-3 py-1 text-xs font-semibold">
      {label}
    </div>
  );
}

export function ProductBoard({
  groups,
  initialGroupOrder,
  initialItems,
  thumbs,
  assetsByProduct,
  wholesalers,
  wholesalersByProduct,
  units,
  categories,
  priceDefaults,
}: {
  groups: ProductGroup[];
  /** Reihenfolge der echten Gruppen-Container (group_id). */
  initialGroupOrder: string[];
  /** Produkte je Container (group_id bzw. "__none__"), bereits sortiert. */
  initialItems: Record<string, Product[]>;
  thumbs: Thumbs;
  assetsByProduct: AssetsMap;
  wholesalers: Wholesaler[];
  wholesalersByProduct: WholesalerLinks;
  units: string[];
  categories: string[];
  priceDefaults?: { safety_pct: number; margin_pct: number };
}) {
  const router = useRouter();
  const [groupOrder, setGroupOrder] =
    React.useState<string[]>(initialGroupOrder);
  const [items, setItems] =
    React.useState<Record<string, Product[]>>(initialItems);
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeType, setActiveType] = React.useState<"item" | "group" | null>(
    null,
  );
  const dragSource = React.useRef<string | null>(null);

  const groupName = React.useCallback(
    (id: string) =>
      id === NONE ? "Ohne Gruppe" : (groups.find((g) => g.id === id)?.name ?? "—"),
    [groups],
  );

  // Auf/Zu-Zustand aus localStorage laden.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("produkte:collapsed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);
  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("produkte:collapsed", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Alle Container in Anzeige-Reihenfolge (echte Gruppen + "Ohne Gruppe" am Ende).
  const containers = React.useMemo(() => [...groupOrder, NONE], [groupOrder]);

  function findContainer(id: string): string | null {
    if (id === NONE || groupOrder.includes(id)) return id;
    for (const c of containers) {
      if ((items[c] ?? []).some((p) => p.id === id)) return c;
    }
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    const type = (e.active.data.current?.type as "item" | "group") ?? "item";
    setActiveId(String(e.active.id));
    setActiveType(type);
    if (type === "item") dragSource.current = findContainer(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    if (activeType !== "item") return;
    const { active, over } = e;
    if (!over) return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;

    setItems((prev) => {
      const fromItems = prev[from] ?? [];
      const toItems = prev[to] ?? [];
      const moving = fromItems.find((p) => p.id === active.id);
      if (!moving) return prev;
      // Einfügeposition im Zielcontainer bestimmen.
      const overIdx = toItems.findIndex((p) => p.id === over.id);
      const insertAt = overIdx >= 0 ? overIdx : toItems.length;
      return {
        ...prev,
        [from]: fromItems.filter((p) => p.id !== active.id),
        [to]: [
          ...toItems.slice(0, insertAt),
          moving,
          ...toItems.slice(insertAt),
        ],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const type = activeType;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    if (type === "group") {
      const oldIdx = groupOrder.indexOf(String(active.id));
      const newIdx = groupOrder.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;
      const next = arrayMove(groupOrder, oldIdx, newIdx);
      setGroupOrder(next);
      void (async () => {
        const res = await reorderGroups(
          next.map((id, i) => ({ id, sort: i })),
        );
        if (!res.ok) {
          toast.error(res.error ?? "Gruppen-Reihenfolge nicht gespeichert");
          router.refresh();
        }
      })();
      return;
    }

    // item
    const container = findContainer(String(over.id)) ?? dragSource.current;
    if (!container) return;
    const list = items[container] ?? [];
    const oldIdx = list.findIndex((p) => p.id === active.id);
    const overIdx = list.findIndex((p) => p.id === over.id);
    let nextItems = items;
    if (oldIdx >= 0 && overIdx >= 0 && oldIdx !== overIdx) {
      nextItems = { ...items, [container]: arrayMove(list, oldIdx, overIdx) };
      setItems(nextItems);
    }
    const affected = Array.from(
      new Set([dragSource.current, container].filter(Boolean) as string[]),
    );
    dragSource.current = null;
    // persist mit dem frischen Stand
    void (async () => {
      const updates = affected.flatMap((c) =>
        (nextItems[c] ?? []).map((p, i) => ({
          id: p.id,
          group_id: c === NONE ? null : c,
          sort: i,
        })),
      );
      const res = await reorderProducts(updates);
      if (!res.ok) {
        toast.error(res.error ?? "Reihenfolge konnte nicht gespeichert werden");
        router.refresh();
      }
    })();
  }

  // ── Suche: gefilterte, nicht-ziehbare Ansicht ────────────────────────────
  const q = query.trim();
  const filtering = q.length > 0;
  const matches = (p: Product) => productMatches(p, q);

  const activeProduct =
    activeType === "item" && activeId
      ? Object.values(items)
          .flat()
          .find((p) => p.id === activeId)
      : null;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Produkte suchen …"
          className="pl-8"
        />
      </div>
      {filtering ? (
        <p className="text-muted-foreground text-xs">
          Während der Suche ist das Sortieren per Drag &amp; Drop deaktiviert.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Tipp: Produkte am Greif-Symbol ziehen — innerhalb einer Gruppe, in eine
          andere Gruppe, oder Gruppen umsortieren.
        </p>
      )}

      {filtering ? (
        <div className="space-y-6">
          {containers.map((c) => {
            const list = (items[c] ?? []).filter(matches);
            if (list.length === 0) return null;
            return (
              <Section
                key={c}
                name={groupName(c)}
                count={list.length}
                collapsed={false}
              >
                {list.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    groups={groups}
                    assets={assetsByProduct[p.id] ?? []}
                    wholesalers={wholesalers}
                    links={wholesalersByProduct[p.id] ?? []}
                    units={units}
                    categories={categories}
                    priceDefaults={priceDefaults}
                    thumb={thumbs[p.id] ?? null}
                  />
                ))}
              </Section>
            );
          })}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={groupOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {groupOrder.map((c) => (
                <SortableGroup
                  key={c}
                  id={c}
                  name={groupName(c)}
                  count={(items[c] ?? []).length}
                  collapsed={collapsed.has(c)}
                  onToggle={() => toggleCollapse(c)}
                >
                  <SortableContext
                    items={(items[c] ?? []).map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {withSubHeaders(items[c] ?? []).map((entry) =>
                      entry.header ? (
                        <SubHeader key={`h-${entry.header}`} label={entry.header} />
                      ) : (
                        <SortableItem
                          key={entry.product!.id}
                          product={entry.product!}
                          groups={groups}
                          assets={assetsByProduct[entry.product!.id] ?? []}
                          wholesalers={wholesalers}
                          links={wholesalersByProduct[entry.product!.id] ?? []}
                          units={units}
                          categories={categories}
                          priceDefaults={priceDefaults}
                          thumb={thumbs[entry.product!.id] ?? null}
                        />
                      ),
                    )}
                  </SortableContext>
                </SortableGroup>
              ))}

              {/* "Ohne Gruppe" — immer als Drop-Ziel vorhanden */}
              <DroppableNone
                count={(items[NONE] ?? []).length}
                collapsed={collapsed.has(NONE)}
                onToggle={() => toggleCollapse(NONE)}
              >
                <SortableContext
                  items={(items[NONE] ?? []).map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {withSubHeaders(items[NONE] ?? []).map((entry) =>
                    entry.header ? (
                      <SubHeader key={`h-${entry.header}`} label={entry.header} />
                    ) : (
                      <SortableItem
                        key={entry.product!.id}
                        product={entry.product!}
                        groups={groups}
                        assets={assetsByProduct[entry.product!.id] ?? []}
                        wholesalers={wholesalers}
                        links={wholesalersByProduct[entry.product!.id] ?? []}
                        units={units}
                        categories={categories}
                        priceDefaults={priceDefaults}
                        thumb={thumbs[entry.product!.id] ?? null}
                      />
                    ),
                  )}
                </SortableContext>
              </DroppableNone>
            </div>
          </SortableContext>

          <DragOverlay>
            {activeProduct ? (
              <RowShell
                product={activeProduct}
                thumb={thumbs[activeProduct.id] ?? null}
                dragging
              />
            ) : activeType === "group" && activeId ? (
              <div className="bg-card rounded-lg border px-3 py-2 text-sm font-semibold shadow-lg">
                {groupName(activeId)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// ── Gruppen-Abschnitt (sortierbar) ──────────────────────────────────────────
function SortableGroup({
  id,
  name,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  name: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    attributes,
    listeners,
  } = useSortable({ id, data: { type: "group" } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <GroupHeader
        name={name}
        count={count}
        collapsed={collapsed}
        onToggle={onToggle}
        handle={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
            title="Gruppe verschieben"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
      {!collapsed ? (
        <div
          className={cn(
            "bg-card min-h-12 divide-y rounded-lg border",
            isOver && "ring-primary ring-2",
          )}
        >
          {count === 0 ? (
            <p className="text-muted-foreground p-3 text-xs">
              Leer — Produkt hierher ziehen.
            </p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── "Ohne Gruppe"-Container (nur Drop-Ziel, nicht verschiebbar) ─────────────
function DroppableNone({
  count,
  collapsed,
  onToggle,
  children,
}: {
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: NONE,
    data: { type: "container" },
    disabled: { draggable: true, droppable: false },
  });
  return (
    <div ref={setNodeRef}>
      <GroupHeader
        name="Ohne Gruppe"
        count={count}
        collapsed={collapsed}
        onToggle={onToggle}
      />
      {!collapsed ? (
        <div
          className={cn(
            "bg-card min-h-12 divide-y rounded-lg border",
            isOver && "ring-primary ring-2",
          )}
        >
          {count === 0 ? (
            <p className="text-muted-foreground p-3 text-xs">
              Produkt hierher ziehen, um die Gruppenzuordnung zu entfernen.
            </p>
          ) : (
            children
          )}
        </div>
      ) : null}
    </div>
  );
}

function GroupHeader({
  name,
  count,
  collapsed,
  onToggle,
  handle,
}: {
  name: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  handle?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {handle}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-sm font-semibold"
      >
        {collapsed ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
        {name}
        <span className="text-muted-foreground font-normal">({count})</span>
      </button>
    </div>
  );
}

// ── Sortierbare Produktzeile ────────────────────────────────────────────────
function SortableItem({
  product,
  groups,
  assets,
  wholesalers,
  links,
  units,
  categories,
  priceDefaults,
  thumb,
}: {
  product: Product;
  groups: ProductGroup[];
  assets: ProductAsset[];
  wholesalers: Wholesaler[];
  links: ProductWholesaler[];
  units: string[];
  categories: string[];
  priceDefaults?: { safety_pct: number; margin_pct: number };
  thumb: string | null;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } =
    useSortable({ id: product.id, data: { type: "item" } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <RowShell
        product={product}
        thumb={thumb}
        handle={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
            title="Produkt verschieben"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
        action={
          <ProductFormDialog
            product={product}
            groups={groups}
            assets={assets}
            wholesalers={wholesalers}
            productWholesalers={links}
            units={units}
            categories={categories}
            priceDefaults={priceDefaults}
            trigger={
              <Button variant="ghost" size="sm">
                Bearbeiten
              </Button>
            }
          />
        }
      />
    </div>
  );
}

/** Nicht-ziehbare Zeile mit Bearbeiten-Aktion (Suchansicht). */
function ProductRow({
  product,
  groups,
  assets,
  wholesalers,
  links,
  units,
  categories,
  priceDefaults,
  thumb,
}: {
  product: Product;
  groups: ProductGroup[];
  assets: ProductAsset[];
  wholesalers: Wholesaler[];
  links: ProductWholesaler[];
  units: string[];
  categories: string[];
  priceDefaults?: { safety_pct: number; margin_pct: number };
  thumb: string | null;
}) {
  return (
    <RowShell
      product={product}
      thumb={thumb}
      action={
        <ProductFormDialog
          product={product}
          groups={groups}
          assets={assets}
          wholesalers={wholesalers}
          productWholesalers={links}
          units={units}
          categories={categories}
          priceDefaults={priceDefaults}
          trigger={
            <Button variant="ghost" size="sm">
              Bearbeiten
            </Button>
          }
        />
      }
    />
  );
}

/** Reine Produkt-Zeile (auch für Suche & DragOverlay). */
function RowShell({
  product: p,
  thumb,
  handle,
  action,
  dragging,
}: {
  product: Product;
  thumb: string | null;
  handle?: React.ReactNode;
  action?: React.ReactNode;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2",
        dragging && "bg-card rounded-lg border shadow-lg",
      )}
    >
      {handle}
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={p.name}
          className="size-9 shrink-0 rounded border object-cover"
        />
      ) : (
        <div className="bg-muted size-9 shrink-0 rounded border" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[p.manufacturer, p.category].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      <div className="text-muted-foreground hidden w-24 text-right text-xs sm:block">
        EK {formatCurrency(p.price_purchase)}
      </div>
      <div className="w-24 text-right text-sm font-medium">
        {formatCurrency(p.price_sell)}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Statischer Abschnitt für die Suchansicht. */
function Section({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">
        {name} <span className="text-muted-foreground font-normal">({count})</span>
      </h2>
      <div className="bg-card divide-y rounded-lg border">{children}</div>
    </div>
  );
}

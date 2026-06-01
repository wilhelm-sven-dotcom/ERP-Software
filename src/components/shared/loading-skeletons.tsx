import { Skeleton } from "@/components/ui/skeleton";

/** Kopfzeile (Titel + Beschreibung) als Platzhalter. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {action ? <Skeleton className="h-9 w-36" /> : null}
    </div>
  );
}

/** Tabellen-Platzhalter (Liste). */
export function TableSkeleton({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="bg-card rounded-lg border">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Karten-Raster (z. B. Dashboard-KPIs). */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card space-y-3 rounded-lg border p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Voller Listen-Platzhalter (Header + Tabelle) — Standard für Modulseiten. */
export function ListPageSkeleton({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}

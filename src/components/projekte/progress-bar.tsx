import { cn } from "@/lib/utils";

/**
 * Dünner Fortschrittsbalken aus dem Aufgaben-Stand eines Projekts.
 * Füllung = erledigt/gesamt (grün); bei überfälligen Aufgaben rote Markierung.
 */
export function ProgressBar({
  done,
  total,
  overdue = 0,
  showLabel = false,
  className,
}: {
  done: number;
  total: number;
  overdue?: number;
  showLabel?: boolean;
  className?: string;
}) {
  if (total === 0) {
    return showLabel ? (
      <span className="text-muted-foreground text-xs">kein Ablauf</span>
    ) : (
      <div className={cn("bg-muted h-1.5 w-full rounded-full", className)} />
    );
  }
  const pct = Math.round((done / total) * 100);
  const complete = done >= total;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full"
        title={`${done}/${total} erledigt${overdue ? ` · ${overdue} überfällig` : ""}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            complete ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
        {overdue > 0 ? (
          <span className="bg-destructive absolute top-0 right-0 h-full w-1.5" />
        ) : null}
      </div>
      {showLabel ? (
        <span
          className={cn(
            "text-xs tabular-nums",
            overdue > 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {done}/{total}
        </span>
      ) : null}
    </div>
  );
}

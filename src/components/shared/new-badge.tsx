import { isNew } from "@/lib/format";

/**
 * Kleine „Neu"-Markierung (blauer Punkt + Label) für Einträge, die in den
 * letzten 24 Stunden angelegt wurden. Rein aus `created_at` abgeleitet — keine
 * Persistenz, verschwindet von selbst. Rendert nichts, wenn nicht (mehr) neu.
 */
export function NewBadge({
  createdAt,
  hours = 24,
  className = "",
}: {
  createdAt: string | null | undefined;
  hours?: number;
  className?: string;
}) {
  if (!isNew(createdAt, hours)) return null;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 " +
        className
      }
      title="In den letzten 24 Stunden angelegt"
    >
      <span className="size-1.5 rounded-full bg-blue-500" />
      Neu
    </span>
  );
}

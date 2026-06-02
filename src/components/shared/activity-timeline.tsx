import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { Activity } from "@/lib/types";

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Noch keine Aktivitäten erfasst.
      </p>
    );
  }

  return (
    <ol className="relative max-h-[28rem] space-y-4 overflow-y-auto border-l pr-1 pl-5">
      {activities.map((a) => (
        <li key={a.id} className="relative">
          <span className="bg-primary ring-background absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full ring-4" />
          <div className="flex flex-wrap items-center gap-2">
            {a.type ? (
              <Badge variant="secondary" className="capitalize">
                {a.type}
              </Badge>
            ) : null}
            <span className="font-medium">{a.title}</span>
            <span className="text-muted-foreground text-xs">
              {formatDateTime(a.occurred_at ?? a.created_at)}
            </span>
          </div>
          {a.body ? (
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
              {a.body}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { navItems } from "@/lib/navigation";

/**
 * Einheitliche Platzhalterseite für Module, die in Phase 3 entstehen.
 * Titel & Icon kommen aus der zentralen Navigation (keine Duplikate).
 */
export function ModulePlaceholder({
  navKey,
  description,
  phase = "Phase 3",
}: {
  navKey: string;
  description: string;
  phase?: string;
}) {
  const item = navItems.find((n) => n.key === navKey);
  const Icon = item?.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <span className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-lg">
          {Icon ? <Icon className="size-5" /> : null}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {item?.label ?? navKey}
          </h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>In Vorbereitung</CardTitle>
          <CardDescription>
            Dieses Modul wird in {phase} umgesetzt.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Das Fundament (Navigation, Theme, Auth-Gerüst) steht. Die Fachlogik
          wird gemäß <code className="text-foreground">CLAUDE.md</code> aus der
          Legacy-Datei übernommen.
        </CardContent>
      </Card>
    </div>
  );
}

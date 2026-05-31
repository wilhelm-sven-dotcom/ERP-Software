import { cn } from "@/lib/utils";

/**
 * Wortmarke „ip³ Energietechnik".
 * Platzhalter bis zum echten Logo-Upload (Modul Einstellungen, Phase 3).
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md text-base font-bold">
        ip<sup className="text-[0.6em]">3</sup>
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">ip³ PV-Tool</span>
        <span className="text-muted-foreground text-xs">Energietechnik</span>
      </div>
    </div>
  );
}

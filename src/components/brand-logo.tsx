import { cn } from "@/lib/utils";

/**
 * Marken-Logo in der App-Shell. Zeigt das in den Einstellungen hinterlegte
 * Firmenlogo (falls vorhanden), sonst die Wortmarke „ip³".
 */
export function BrandLogo({
  className,
  logoUrl,
}: {
  className?: string;
  logoUrl?: string | null;
}) {
  if (logoUrl) {
    return (
      <div className={cn("flex items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="Firmenlogo"
          className="h-9 max-w-[180px] object-contain"
        />
      </div>
    );
  }
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

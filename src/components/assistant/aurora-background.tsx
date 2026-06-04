/**
 * Dezenter, „atmender" Aurora-Hintergrund für die KI-Startseite.
 * Dunkle Basis + 3 weich gezeichnete radiale Blobs in Marken-Blau/Cyan, die
 * langsam pulsieren (siehe `.aurora-blob` / `@keyframes aurora-breathe` in
 * globals.css; bei `prefers-reduced-motion` statisch). Rein dekorativ.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background">
      <div
        className="aurora-blob absolute -top-40 -left-32 size-[42rem] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, #0071e3 0%, rgba(0,113,227,0) 70%)",
          animationDuration: "7s",
        }}
      />
      <div
        className="aurora-blob absolute top-1/3 -right-40 size-[46rem] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, #5ac8fa 0%, rgba(90,200,250,0) 70%)",
          animationDuration: "8.5s",
          animationDelay: "-2.5s",
        }}
      />
      <div
        className="aurora-blob absolute -bottom-48 left-1/4 size-[40rem] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, #0a84ff 0%, rgba(10,132,255,0) 70%)",
          animationDuration: "9.5s",
          animationDelay: "-5s",
        }}
      />
    </div>
  );
}

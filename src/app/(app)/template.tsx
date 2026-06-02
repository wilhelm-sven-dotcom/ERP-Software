/**
 * Sanfter Seitenübergang: template.tsx wird bei jeder Navigation neu gemountet,
 * dadurch spielt die Einblend-Animation bei jedem Seitenwechsel erneut ab.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out">
      {children}
    </div>
  );
}

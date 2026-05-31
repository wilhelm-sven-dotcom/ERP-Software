import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Kalkulation",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="kalkulation"
      description="Positionen & Summen – Fachlogik 1:1 aus der Legacy-Datei."
      phase="Phase 3"
    />
  );
}

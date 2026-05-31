import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Wirtschaftlichkeit",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="wirtschaft"
      description="Wirtschaftlichkeitsberechnung – Fachlogik 1:1 aus der Legacy-Datei."
      phase="Phase 3"
    />
  );
}

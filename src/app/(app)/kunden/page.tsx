import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Kunden",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="kunden"
      description="Kundenstamm mit Aktivitäten-Timeline."
      phase="Phase 3"
    />
  );
}

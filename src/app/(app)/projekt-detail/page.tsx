import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Aktives Projekt",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="projekt-detail"
      description="Das aktuell gewählte Projekt inkl. Logbuch/Timeline."
      phase="Phase 3"
    />
  );
}

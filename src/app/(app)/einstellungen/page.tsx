import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Einstellungen",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="einstellungen"
      description="Firmendaten, Logo und Standardwerte."
      phase="Phase 3"
    />
  );
}

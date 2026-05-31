import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Produkte",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="produkte"
      description="Produktkatalog mit Gruppen und Datenblatt-Assets."
      phase="Phase 3"
    />
  );
}

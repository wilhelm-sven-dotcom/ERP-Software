import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Projekte",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="projekte"
      description="Alle Projekte – Liste, Detail, Anlegen und Bearbeiten."
      phase="Phase 3"
    />
  );
}

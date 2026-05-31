import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Hilfe",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="hilfe"
      description="Hilfe und Dokumentation."
      phase="Phase 4"
    />
  );
}

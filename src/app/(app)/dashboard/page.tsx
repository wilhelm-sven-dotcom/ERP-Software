import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="dashboard"
      description="Kennzahlen, aggregiert über alle Projekte."
      phase="Phase 3"
    />
  );
}

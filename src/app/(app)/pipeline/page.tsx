import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="pipeline"
      description="Projekte nach Vertriebsstatus (Stufen/Filter)."
      phase="Phase 3"
    />
  );
}

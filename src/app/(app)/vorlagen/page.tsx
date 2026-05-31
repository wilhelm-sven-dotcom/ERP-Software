import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Vorlagen",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="vorlagen"
      description="Angebots- und Kalkulationsvorlagen."
      phase="Phase 3"
    />
  );
}

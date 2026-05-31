import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Mitarbeiter",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="mitarbeiter"
      description="Mitarbeiter, Rollen und Einladungen (Admin)."
      phase="Phase 3"
    />
  );
}

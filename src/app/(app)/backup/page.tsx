import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Backup",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="backup"
      description="Export und Import der Daten (aus Supabase)."
      phase="Phase 3"
    />
  );
}

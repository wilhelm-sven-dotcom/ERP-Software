import type { Metadata } from "next";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = {
  title: "Angebot",
};

export default function Page() {
  return (
    <ModulePlaceholder
      navKey="angebot"
      description="Angebotserstellung, Druck und Export – baut auf der Kalkulation auf."
      phase="Phase 3"
    />
  );
}

import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { BuchhaltungTabs } from "@/components/buchhaltung/buchhaltung-tabs";
import { UebersichtSection } from "@/components/buchhaltung/uebersicht-section";
import { RechnungenSection } from "@/components/buchhaltung/rechnungen-section";
import { OffenePostenSection } from "@/components/buchhaltung/offene-posten-section";
import { EingangsbelegeSection } from "@/components/buchhaltung/eingangsbelege-section";

export const metadata: Metadata = { title: "Buchhaltung" };

export default async function BuchhaltungPage() {
  return (
    <div>
      <PageHeader
        title="Buchhaltung"
        description="Rechnungen, offene Posten/Mahnungen und eingezogene Belege."
      />
      <SupabaseNotice />
      <BuchhaltungTabs
        uebersicht={<UebersichtSection />}
        rechnungen={<RechnungenSection />}
        offenePosten={<OffenePostenSection />}
        eingangsbelege={<EingangsbelegeSection />}
      />
    </div>
  );
}

import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "@/components/einstellungen/company-form";
import { getCompanySettings } from "@/lib/data/settings";
import { getCurrentEmployee } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  const [company, me] = await Promise.all([
    getCompanySettings(),
    getCurrentEmployee(),
  ]);
  const isAdmin = me?.role === "admin";

  return (
    <div>
      <PageHeader
        title="Einstellungen"
        description="Firmendaten für Angebote und Dokumente."
      />

      <SupabaseNotice />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Firmendaten</CardTitle>
        </CardHeader>
        <CardContent>
          {!isAdmin ? (
            <p className="text-muted-foreground mb-4 text-sm">
              Nur Administratoren können diese Werte ändern.
            </p>
          ) : null}
          <CompanyForm company={company} disabled={!isAdmin} />
        </CardContent>
      </Card>
    </div>
  );
}

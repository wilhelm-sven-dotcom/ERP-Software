import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/einstellungen/company-form";
import { getCompanySettings } from "@/lib/data/settings";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getIntegration, isGoogleConfigured } from "@/lib/google/calendar";
import { disconnectGoogle } from "@/app/(app)/einstellungen/actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const [company, me, { google }] = await Promise.all([
    getCompanySettings(),
    getCurrentEmployee(),
    searchParams,
  ]);
  const isAdmin = me?.role === "admin";
  const googleConfigured = isGoogleConfigured();
  const integration = me?.id
    ? await getIntegration(me.id)
    : { connected: false, connected_at: null };

  return (
    <div>
      <PageHeader
        title="Einstellungen"
        description="Firmendaten und persönliche Integrationen."
      />

      <SupabaseNotice />

      <Card className="mb-4 max-w-3xl">
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

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Google-Kalender (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {google === "connected" ? (
            <p className="text-primary">Verbindung erfolgreich hergestellt.</p>
          ) : google === "error" ? (
            <p className="text-destructive">
              Verbindung fehlgeschlagen. Bitte erneut versuchen.
            </p>
          ) : null}

          {!googleConfigured ? (
            <p className="text-muted-foreground">
              Die Google-Anbindung ist serverseitig noch nicht konfiguriert
              (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Anleitung in
              <code className="mx-1">supabase/SETUP.md</code>.
            </p>
          ) : integration.connected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground">
                Verbunden{integration.connected_at
                  ? ` seit ${formatDate(integration.connected_at)}`
                  : ""}
                . Deine Termine erscheinen im Dashboard.
              </p>
              <form action={disconnectGoogle}>
                <Button type="submit" variant="outline" size="sm">
                  Verbindung trennen
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground">
                Verbinde deinen Google-Kalender, um Termine im Dashboard zu sehen.
                Es wird nur gelesen — nichts in deinen Kalender geschrieben.
              </p>
              <Button asChild size="sm">
                <a href="/api/google/oauth/start">Mit Google verbinden</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

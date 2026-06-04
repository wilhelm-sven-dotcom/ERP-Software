import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompanyForm } from "@/components/einstellungen/company-form";
import { WirtschaftDefaultsForm } from "@/components/einstellungen/wirtschaft-defaults-form";
import { getCompanySettings, getWirtschaftDefaults } from "@/lib/data/settings";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getIntegration, isGoogleConfigured } from "@/lib/google/calendar";
import { isDocIntelConfigured } from "@/lib/ai/doc-intelligence";
import { isAiConfigured } from "@/lib/ai/openai";
import { isWebSearchConfigured } from "@/lib/ai/websearch";
import { disconnectGoogle } from "@/app/(app)/einstellungen/actions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const [company, me, { google }, wirtschaft] = await Promise.all([
    getCompanySettings(),
    getCurrentEmployee(),
    searchParams,
    getWirtschaftDefaults(),
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

      <Card className="mb-4 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Wirtschaftlichkeits-Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          {!isAdmin ? (
            <p className="text-muted-foreground mb-4 text-sm">
              Nur Administratoren können diese Werte ändern.
            </p>
          ) : null}
          <p className="text-muted-foreground mb-3 text-sm">
            Standardwerte für die Wirtschaftlichkeitsberechnung (gelten projektübergreifend, je
            Projekt überschreibbar).
          </p>
          <WirtschaftDefaultsForm defaults={wirtschaft} disabled={!isAdmin} />
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

      <Card className="mt-4 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">KI-Dienste (Status)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatusRow
            label="KI (Klassifizierung & Assistent)"
            on={isAiConfigured()}
            env="OPENAI_API_KEY"
          />
          <StatusRow
            label="Dokument-Auslese (Azure Document Intelligence)"
            on={isDocIntelConfigured()}
            env="AZURE_DOCINTEL_ENDPOINT / _KEY"
          />
          <StatusRow
            label="Web-Suche (Datenblätter & Dokumente)"
            on={isWebSearchConfigured()}
            env="WEB_SEARCH_API_KEY"
          />
          <p className="text-muted-foreground pt-1 text-xs">
            Inaktiv bedeutet nur, dass der jeweilige Schlüssel fehlt — die App läuft mit
            Fallback weiter. Schlüssel in Vercel (Environment Variables) hinterlegen und neu
            deployen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ label, on, env }: { label: string; on: boolean; env: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{label}</p>
        <p className="text-muted-foreground truncate text-xs">{env}</p>
      </div>
      <span
        className={
          on
            ? "shrink-0 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-600"
            : "text-muted-foreground bg-muted shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
        }
      >
        {on ? "Aktiv" : "Inaktiv"}
      </span>
    </div>
  );
}

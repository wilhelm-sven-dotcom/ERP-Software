import type { Metadata } from "next";
import { Download } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentEmployee } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Backup" };

export default async function BackupPage() {
  const me = await getCurrentEmployee();
  const isAdmin = me?.role === "admin";

  return (
    <div>
      <PageHeader
        title="Backup"
        description="Daten als JSON exportieren."
      />

      <SupabaseNotice />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Exportiert alle Tabellen (Kunden, Projekte, Aktivitäten, Produkte,
            Vorlagen, Kalkulationen, Einstellungen) in eine JSON-Datei.
            Datenblätter/Bilder sind nicht enthalten.
          </p>
          {isAdmin ? (
            <Button asChild>
              <a href="/backup/route-export" download>
                <Download className="size-4" /> Backup herunterladen
              </a>
            </Button>
          ) : (
            <p className="text-sm">
              Nur Administratoren können ein Backup exportieren.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

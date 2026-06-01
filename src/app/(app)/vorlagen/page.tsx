import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOfferTemplates, getCalcTemplates } from "@/lib/data/templates";

export const metadata: Metadata = { title: "Vorlagen" };

export default async function VorlagenPage() {
  const [offerTemplates, calcTemplates] = await Promise.all([
    getOfferTemplates(),
    getCalcTemplates(),
  ]);

  return (
    <div>
      <PageHeader
        title="Vorlagen"
        description="Angebots- und Kalkulationsvorlagen."
      />

      <SupabaseNotice />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Angebotsvorlagen</CardTitle>
          </CardHeader>
          <CardContent>
            {offerTemplates.length === 0 ? (
              <EmptyState
                title="Keine Angebotsvorlagen"
                description="Vorlagen werden mit dem Angebotsmodul (Phase 3) erstellt."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="w-24">Standard</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerTemplates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.kind ?? "–"}
                      </TableCell>
                      <TableCell>
                        {t.is_default ? <Badge>Standard</Badge> : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kalkulationsvorlagen</CardTitle>
          </CardHeader>
          <CardContent>
            {calcTemplates.length === 0 ? (
              <EmptyState
                title="Keine Kalkulationsvorlagen"
                description="Vorlagen werden mit dem Kalkulationsmodul erstellt oder per Preislisten-Import angelegt."
              />
            ) : (
              <>
                <p className="text-muted-foreground mb-3 text-sm">
                  In der <strong>Kalkulation</strong> eines Projekts oben
                  „Vorlage übernehmen" wählen — die Positionen werden geladen,
                  du trägst nur die Mengen ein.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Positionen</TableHead>
                      <TableHead className="w-24">Standard</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calcTemplates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {Array.isArray(t.positions) ? t.positions.length : 0}
                        </TableCell>
                        <TableCell>
                          {t.is_default ? <Badge>Standard</Badge> : "–"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

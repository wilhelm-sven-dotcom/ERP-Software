import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createCalcTemplate } from "@/app/(app)/vorlagen/actions";
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
import { getAllTextBlocks } from "@/lib/data/text-blocks";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { TextBlockManager } from "@/components/vorlagen/text-block-manager";

export const metadata: Metadata = { title: "Vorlagen" };

export default async function VorlagenPage() {
  const [offerTemplates, calcTemplates, textBlocks, me] = await Promise.all([
    getOfferTemplates(),
    getCalcTemplates(),
    getAllTextBlocks(),
    getCurrentEmployee(),
  ]);
  const isAdmin = me?.role === "admin";

  return (
    <div>
      <PageHeader
        title="Vorlagen"
        description="Angebots- und Kalkulationsvorlagen."
      >
        <form action={createCalcTemplate}>
          <Button type="submit">
            <Plus className="size-4" /> Neue Kalkulationsvorlage
          </Button>
        </form>
      </PageHeader>

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
                  „Vorlage übernehmen“ wählen — die Positionen werden geladen,
                  du trägst nur die Mengen ein.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Positionen</TableHead>
                      <TableHead className="w-24">Standard</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calcTemplates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/vorlagen/${t.id}`}
                            className="hover:underline"
                          >
                            {t.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {Array.isArray(t.positions) ? t.positions.length : 0}
                        </TableCell>
                        <TableCell>
                          {t.is_default ? <Badge>Standard</Badge> : "–"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/vorlagen/${t.id}`}>Bearbeiten</Link>
                          </Button>
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

      {isAdmin ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Angebots-Textbausteine</CardTitle>
          </CardHeader>
          <CardContent>
            <TextBlockManager blocks={textBlocks} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

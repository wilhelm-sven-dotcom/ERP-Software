import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TimeEntryForm } from "@/components/zeiterfassung/time-entry-form";
import { getProjects } from "@/lib/data/projects";
import { getTimeEntries } from "@/lib/data/time";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { deleteTimeEntry } from "@/app/(app)/zeiterfassung/actions";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Zeiterfassung" };

export default async function ZeiterfassungPage() {
  const me = await getCurrentEmployee();
  const isAdmin = me?.role === "admin";
  const [projects, entries] = await Promise.all([
    getProjects(),
    getTimeEntries(isAdmin ? undefined : me?.id),
  ]);
  const projectOptions = projects.map((p) => ({ id: p.id, title: p.title }));
  const totalHours = entries.reduce((s, e) => s + (Number(e.hours) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Zeiterfassung"
        description="Stunden je Projekt erfassen — Grundlage der Nachkalkulation."
      />
      <SupabaseNotice />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Stunden erfassen</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeEntryForm projects={projectOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isAdmin ? "Alle Einträge" : "Meine Einträge"}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {formatNumber(totalHours)} Std
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch keine Einträge.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Datum</TableHead>
                  <TableHead>Projekt</TableHead>
                  {isAdmin ? <TableHead>Mitarbeiter</TableHead> : null}
                  <TableHead>Tätigkeit</TableHead>
                  <TableHead className="text-right">Std</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(e.work_date)}
                    </TableCell>
                    <TableCell>
                      {e.project ? (
                        <Link href={`/projekte/${e.project.id}`} className="hover:underline">
                          {e.project.title ?? "Projekt"}
                        </Link>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    {isAdmin ? (
                      <TableCell className="text-muted-foreground">
                        {e.employee?.name ?? "–"}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-muted-foreground">
                      {e.activity ?? "–"}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(e.hours)}</TableCell>
                    <TableCell>
                      <form action={deleteTimeEntry}>
                        <input type="hidden" name="id" value={e.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          ✕
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

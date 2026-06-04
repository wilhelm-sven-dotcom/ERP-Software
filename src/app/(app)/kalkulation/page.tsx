import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Star } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProjects } from "@/lib/data/projects";
import { getAllCalculations } from "@/lib/data/calculations";
import { customerName, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Kalkulation" };

export default async function KalkulationPage() {
  const [projects, calcs] = await Promise.all([
    getProjects(),
    getAllCalculations(),
  ]);

  // Varianten je Projekt gruppieren.
  const byProject = new Map<string, typeof calcs>();
  for (const c of calcs) {
    if (!c.project_id) continue;
    const list = byProject.get(c.project_id) ?? [];
    list.push(c);
    byProject.set(c.project_id, list);
  }

  return (
    <div>
      <PageHeader
        title="Kalkulation"
        description="Projekt wählen, um dessen Kalkulation zu bearbeiten."
      />

      <SupabaseNotice />

      {projects.length === 0 ? (
        <EmptyState
          title="Keine Projekte"
          description="Lege zuerst ein Projekt an, um eine Kalkulation zu erstellen."
        >
          <Button asChild>
            <Link href="/projekte">Zu den Projekten</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projekt</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Varianten</TableHead>
                <TableHead className="text-right">kWp</TableHead>
                <TableHead className="text-right">kWh</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const variants = byProject.get(p.id) ?? [];
                const has = variants.length > 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.title ?? "Ohne Titel"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.customer ? customerName(p.customer) : "–"}
                    </TableCell>
                    <TableCell>
                      {has ? (
                        <div className="flex flex-wrap gap-1">
                          {variants.map((v) => (
                            <Link
                              key={v.id}
                              href={`/kalkulation/${p.id}?calc=${v.id}`}
                              className="bg-muted hover:bg-muted/70 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                            >
                              {v.is_selected ? (
                                <Star className="size-3 fill-current text-amber-500" />
                              ) : null}
                              {v.name ?? "Variante"}
                              <span className="text-muted-foreground">
                                {v.system_size_kwp
                                  ? ` ${formatNumber(v.system_size_kwp)} kWp`
                                  : ""}
                                {v.storage_kwh
                                  ? ` / ${formatNumber(v.storage_kwh)} kWh`
                                  : ""}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          keine
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.system_size_kwp)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(p.storage_kwh)}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/kalkulation/${p.id}`}>
                          <Calculator className="size-4" />{" "}
                          {has ? "Kalkulation" : "Kalkulieren"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

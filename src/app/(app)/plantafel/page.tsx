import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { PlantafelBoard } from "@/components/plantafel/plantafel-board";
import { getEmployees } from "@/lib/data/employees";
import { getProjects } from "@/lib/data/projects";
import { getDispoEntries } from "@/lib/data/dispo";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Plantafel" };

/** Montag der Woche zu einem Datum (ISO yyyy-mm-dd). */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mo=0 … So=6
  d.setDate(d.getDate() - day);
  d.setHours(12, 0, 0, 0);
  return d;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default async function PlantafelPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const base = sp.week ? new Date(sp.week) : new Date();
  const monday = mondayOf(isNaN(base.getTime()) ? new Date() : base);
  const days = Array.from({ length: 7 }, (_, i) => iso(addDays(monday, i)));
  const from = days[0];
  const to = days[6];

  const [employees, projects, entries] = await Promise.all([
    getEmployees(),
    getProjects(),
    getDispoEntries(from, to),
  ]);

  const employeeOptions = employees
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, name: e.name ?? e.email ?? "Mitarbeiter" }));
  const projectOptions = projects.map((p) => ({
    id: p.id,
    title: p.title
      ? p.customer
        ? `${p.title} · ${customerName(p.customer)}`
        : p.title
      : "Ohne Titel",
  }));

  const prev = iso(addDays(monday, -7));
  const next = iso(addDays(monday, 7));
  const weekLabel = `${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(monday)} – ${new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(addDays(monday, 6))}`;

  return (
    <div>
      <PageHeader title="Plantafel" description="Wochen-Einsatzplanung — Termine per Drag & Drop verschieben.">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild title="Vorige Woche">
            <Link href={`/plantafel?week=${prev}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <span className="px-2 text-sm font-medium">{weekLabel}</span>
          <Button variant="outline" size="icon" asChild title="Nächste Woche">
            <Link href={`/plantafel?week=${next}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </PageHeader>
      <SupabaseNotice />

      <PlantafelBoard
        employees={employeeOptions}
        projects={projectOptions}
        days={days}
        entries={entries}
      />
    </div>
  );
}

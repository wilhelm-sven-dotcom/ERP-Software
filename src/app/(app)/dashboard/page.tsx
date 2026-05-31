import type { Metadata } from "next";
import Link from "next/link";
import { Users, FolderKanban, TrendingUp, Sun } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProjects } from "@/lib/data/projects";
import { getCustomers } from "@/lib/data/customers";
import { customerName, formatNumber } from "@/lib/format";
import { statusVariant } from "@/lib/constants";

export const metadata: Metadata = { title: "Dashboard" };

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const [projects, customers] = await Promise.all([
    getProjects(),
    getCustomers(),
  ]);

  const won = projects.filter((p) => p.status === "gewonnen").length;
  const totalKwp = projects.reduce(
    (sum, p) => sum + (p.system_size_kwp ?? 0),
    0,
  );
  const recent = projects.slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Überblick über Kunden und Projekte."
      />

      <SupabaseNotice />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Kunden" value={formatNumber(customers.length, 0)} icon={Users} />
        <Kpi
          label="Projekte"
          value={formatNumber(projects.length, 0)}
          icon={FolderKanban}
        />
        <Kpi label="Gewonnen" value={formatNumber(won, 0)} icon={TrendingUp} />
        <Kpi
          label="Summe kWp"
          value={formatNumber(totalKwp)}
          icon={Sun}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Neueste Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Noch keine Projekte vorhanden.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/projekte/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.title ?? "Ohne Titel"}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.customer ? customerName(p.customer) : "Kein Kunde"}
                    </p>
                  </div>
                  <Badge variant={statusVariant(p.status)}>
                    {p.status ?? "–"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

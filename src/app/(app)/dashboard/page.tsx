import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  TrendingUp,
  Sun,
  Euro,
  BatteryCharging,
  UserPlus,
  MessageSquare,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProjects } from "@/lib/data/projects";
import { getCustomers } from "@/lib/data/customers";
import { getAdminStats } from "@/lib/data/stats";
import { getMyOpenTasks } from "@/lib/data/workflow";
import { getSalesEmployees } from "@/lib/data/employees";
import { LeadIntakeDialog } from "@/components/vertrieb/lead-intake-dialog";
import { getInbox, type InboxItem } from "@/lib/data/notifications";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { GlobalSearch } from "@/components/shared/global-search";
import { customerName, formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { statusVariant } from "@/lib/constants";

export const metadata: Metadata = { title: "Dashboard" };

function Kpi({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const card = (
    <Card className={href ? "hover:border-primary transition-colors" : ""}>
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
  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

export default async function DashboardPage() {
  const [me, salesEmployees] = await Promise.all([
    getCurrentEmployee(),
    getSalesEmployees(),
  ]);
  const isAdmin = me?.role === "admin";

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isAdmin
            ? "Umsatz, verkaufte Leistung und Pipeline."
            : "Deine Aufgaben und Projekte."
        }
      >
        <LeadIntakeDialog salesEmployees={salesEmployees} />
      </PageHeader>
      <SupabaseNotice />
      <div className="mb-4">
        <GlobalSearch variant="dashboard" />
      </div>
      {isAdmin ? <AdminDashboard /> : <EmployeeDashboard employeeId={me?.id ?? null} />}
    </div>
  );
}

async function AdminDashboard() {
  const [projects, customers, stats] = await Promise.all([
    getProjects(),
    getCustomers(),
    getAdminStats(),
  ]);
  const recent = projects.slice(0, 6);
  const maxRevenue = Math.max(1, ...stats.months.map((m) => m.revenue));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Umsatz (angenommen)"
          value={formatCurrency(stats.revenueTotal)}
          icon={Euro}
        />
        <Kpi label="Verkauft kWp" value={formatNumber(stats.soldKwp)} icon={Sun} />
        <Kpi
          label="Verkauft kWh"
          value={formatNumber(stats.soldKwh)}
          icon={BatteryCharging}
        />
        <Kpi
          label="Pipeline (offen)"
          value={formatCurrency(stats.pipelineValue)}
          icon={TrendingUp}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Kunden" value={formatNumber(customers.length, 0)} icon={Users} href="/kunden" />
        <Kpi
          label="Projekte"
          value={formatNumber(projects.length, 0)}
          icon={FolderKanban}
          href="/projekte"
        />
        <Kpi label="Pipeline kWp" value={formatNumber(stats.pipelineKwp)} icon={Sun} />
        <Kpi label="Pipeline kWh" value={formatNumber(stats.pipelineKwh)} icon={BatteryCharging} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Umsatz & verkaufte Leistung je Monat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            {stats.months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-muted-foreground text-xs">
                  {m.revenue > 0 ? formatCurrency(m.revenue) : ""}
                </span>
                <div
                  className="bg-primary/80 w-full rounded-t"
                  style={{ height: `${Math.round((m.revenue / maxRevenue) * 120) + 2}px` }}
                  title={`${formatCurrency(m.revenue)} · ${formatNumber(m.kwp)} kWp · ${formatNumber(m.kwh)} kWh`}
                />
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-muted-foreground text-[10px]">
                  {formatNumber(m.kwp)} kWp
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Neueste Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentProjects projects={recent} />
        </CardContent>
      </Card>
    </>
  );
}

async function EmployeeDashboard({ employeeId }: { employeeId: string | null }) {
  const [projects, tasks, events, inbox] = await Promise.all([
    getProjects(),
    employeeId ? getMyOpenTasks(employeeId) : Promise.resolve([]),
    employeeId ? listUpcomingEvents(employeeId) : Promise.resolve([]),
    employeeId ? getInbox(employeeId) : Promise.resolve({ offered: [], unread: [], total: 0 }),
  ]);
  const myProjects = projects.filter((p) => p.assigned_employee_id === employeeId);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const upcoming = tasks.filter((t) => !t.due_date || t.due_date > today);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Offene Aufgaben" value={formatNumber(tasks.length, 0)} icon={TrendingUp} />
        <Kpi label="Dir angeboten" value={formatNumber(inbox.offered.length, 0)} icon={UserPlus} />
        <Kpi label="Ungelesen" value={formatNumber(inbox.unread.length, 0)} icon={MessageSquare} />
        <Kpi label="Meine Projekte" value={formatNumber(myProjects.length, 0)} icon={FolderKanban} href="/projekte" />
      </div>

      {inbox.offered.length > 0 || inbox.unread.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Posteingang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inbox.offered.length > 0 ? (
              <InboxGroup title="Dir angeboten" items={inbox.offered} />
            ) : null}
            {inbox.unread.length > 0 ? (
              <InboxGroup title="Ungelesene Nachrichten" items={inbox.unread} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meine Aufgaben</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Keine offenen Aufgaben. 🎉
              </p>
            ) : (
              <div className="space-y-4">
                <TaskGroup title="Überfällig" items={overdue} tone="destructive" />
                <TaskGroup title="Heute" items={dueToday} />
                <TaskGroup title="Als Nächstes" items={upcoming} />
              </div>
            )}
          </CardContent>
        </Card>

        {events.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meine Termine</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {events.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{ev.summary}</span>
                    <span className="text-muted-foreground text-xs">
                      {ev.start
                        ? new Intl.DateTimeFormat("de-DE", {
                            dateStyle: "short",
                            ...(ev.allDay ? {} : { timeStyle: "short" }),
                          }).format(new Date(ev.start))
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function InboxGroup({ title, items }: { title: string; items: InboxItem[] }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-semibold">
        {title} ({items.length})
      </p>
      <ul className="divide-y">
        {items.map((it) => (
          <li key={`${it.reason}-${it.task_id}`} className="py-2 text-sm">
            <Link
              href={it.project_id ? `/projekte/${it.project_id}` : "/dashboard"}
              className="font-medium hover:underline"
            >
              {it.title}
            </Link>
            <span className="text-muted-foreground ml-2 text-xs">
              {it.reason === "angeboten" ? "annehmen?" : "neue Nachricht"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: { id: string; title: string; due_date: string | null; project: { id: string; title: string | null } | null }[];
  tone?: "destructive";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`mb-1 text-xs font-semibold ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
        {title} ({items.length})
      </p>
      <ul className="divide-y">
        {items.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
              {t.title}
              {t.project ? (
                <Link
                  href={`/projekte/${t.project.id}`}
                  className="text-muted-foreground ml-2 text-xs hover:underline"
                >
                  {t.project.title ?? "Projekt"}
                </Link>
              ) : null}
            </span>
            <span className="text-muted-foreground text-xs">
              {t.due_date ? formatDate(t.due_date) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentProjects({
  projects,
}: {
  projects: Awaited<ReturnType<typeof getProjects>>;
}) {
  if (projects.length === 0) {
    return <p className="text-muted-foreground text-sm">Noch keine Projekte vorhanden.</p>;
  }
  return (
    <ul className="divide-y">
      {projects.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <Link href={`/projekte/${p.id}`} className="font-medium hover:underline">
              {p.title ?? "Ohne Titel"}
            </Link>
            <p className="text-muted-foreground truncate text-xs">
              {p.customer ? customerName(p.customer) : "Kein Kunde"}
            </p>
          </div>
          <Badge variant={statusVariant(p.status)}>{p.status ?? "–"}</Badge>
        </li>
      ))}
    </ul>
  );
}

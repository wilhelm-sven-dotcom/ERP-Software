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
  Target,
  FileText,
  Eye,
} from "lucide-react";
import type { Employee } from "@/lib/types";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProjects, getMyLeads } from "@/lib/data/projects";
import { getProducts } from "@/lib/data/products";
import { getCustomers } from "@/lib/data/customers";
import { getEmployees } from "@/lib/data/employees";
import { GlobalFileDrop } from "@/components/shared/global-file-drop";
import { MyTasksPanel } from "@/components/shared/my-tasks-panel";
import { TeamViewSelect } from "@/components/dashboard/team-view-select";
import { getAdminStats } from "@/lib/data/stats";
import {
  getMyOpenTasks,
  getEmployeesTaskLoad,
  type EmployeeTaskLoad,
} from "@/lib/data/workflow";
import { getSalesEmployees } from "@/lib/data/employees";
import { LeadIntakeDialog } from "@/components/vertrieb/lead-intake-dialog";
import { getInbox, getOverdueTasks, type InboxItem } from "@/lib/data/notifications";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { isAiConfigured } from "@/lib/ai/openai";
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const [me, salesEmployees, dropProjects, dropProducts, allEmployees] = await Promise.all([
    getCurrentEmployee(),
    getSalesEmployees(),
    getProjects(),
    getProducts(),
    getEmployees(),
  ]);
  const isAdmin = me?.role === "admin";
  const projectOptions = dropProjects.map((p) => ({
    id: p.id,
    title: p.title ?? "Ohne Titel",
  }));

  // Mitarbeiter-Sicht (nur Admin): die Aufgaben/Leads eines Kollegen read-only ansehen.
  const viewTarget =
    isAdmin && as && as !== me?.id
      ? allEmployees.find((e) => e.id === as) ?? null
      : null;

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
        {isAdmin ? (
          <TeamViewSelect
            employees={allEmployees
              .filter((e) => e.active && e.id !== me?.id)
              .map((e) => ({ id: e.id, name: e.name ?? e.email ?? "Mitarbeiter" }))}
            current={viewTarget?.id ?? null}
          />
        ) : null}
        <LeadIntakeDialog salesEmployees={salesEmployees} />
      </PageHeader>
      <SupabaseNotice />

      {viewTarget ? (
        <>
          <div className="border-primary/30 bg-primary/5 mb-4 flex items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm">
            <span>
              Sicht von <span className="font-semibold">{viewTarget.name ?? viewTarget.email}</span>{" "}
              (read-only)
            </span>
            <Link href="/dashboard" className="text-primary hover:underline">
              ← zurück zu meiner Sicht
            </Link>
          </div>
          {viewTarget.is_sales ? (
            <SalesDashboard employeeId={viewTarget.id} readOnly />
          ) : (
            <EmployeeDashboard employeeId={viewTarget.id} readOnly />
          )}
        </>
      ) : (
        <>
          <div className="mb-4">
            <GlobalSearch variant="dashboard" aiEnabled={isAiConfigured()} />
          </div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Dateien ablegen</CardTitle>
            </CardHeader>
            <CardContent>
              <GlobalFileDrop
                projects={projectOptions}
                products={dropProducts}
                aiEnabled={isAiConfigured()}
              />
            </CardContent>
          </Card>
          {isAdmin ? (
            <AdminDashboard meId={me?.id ?? null} />
          ) : me?.is_sales ? (
            <SalesDashboard employeeId={me.id} />
          ) : (
            <EmployeeDashboard employeeId={me?.id ?? null} />
          )}
        </>
      )}
    </div>
  );
}

async function SalesDashboard({
  employeeId,
  readOnly = false,
}: {
  employeeId: string;
  readOnly?: boolean;
}) {
  const [leads, tasks, inbox] = await Promise.all([
    getMyLeads(employeeId),
    getMyOpenTasks(employeeId),
    getInbox(employeeId),
  ]);
  const anfragen = leads.filter((l) => l.status === "Anfrage");
  const angebote = leads.filter((l) => l.status === "Angebot");
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Offene Anfragen" value={formatNumber(anfragen.length, 0)} icon={Target} />
        <Kpi label="Angebote offen" value={formatNumber(angebote.length, 0)} icon={FileText} />
        <Kpi label="Nachfassen" value={formatNumber(tasks.length, 0)} icon={TrendingUp} />
        <Kpi label="Überfällig" value={formatNumber(overdue.length, 0)} icon={MessageSquare} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meine Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aktuell keine offenen Leads.</p>
            ) : (
              <ul className="divide-y">
                {leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/projekte/${l.id}`} className="font-medium hover:underline">
                        {l.title ?? "Anfrage"}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">
                        {l.customer ? customerName(l.customer) : "Kein Kunde"}
                        {l.source ? ` · ${l.source}` : ""}
                      </p>
                    </div>
                    <Badge variant={statusVariant(l.status)}>{l.status ?? "–"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nachfassen</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine offenen Vertriebsaufgaben.</p>
            ) : (
              <MyTasksPanel tasks={tasks} currentEmployeeId={employeeId} readOnly={readOnly} />
            )}
          </CardContent>
        </Card>
      </div>

      {inbox.total > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Posteingang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inbox.overdue.length > 0 ? <InboxGroup title="Überfällig" items={inbox.overdue} /> : null}
            {inbox.offered.length > 0 ? <InboxGroup title="Dir angeboten" items={inbox.offered} /> : null}
            {inbox.unread.length > 0 ? <InboxGroup title="Ungelesene Nachrichten" items={inbox.unread} /> : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

async function AdminDashboard({ meId }: { meId: string | null }) {
  const [projects, customers, stats, overdue, employees, taskLoad] = await Promise.all([
    getProjects(),
    getCustomers(),
    getAdminStats(),
    getOverdueTasks(),
    getEmployees(),
    getEmployeesTaskLoad(),
  ]);
  const recent = projects.slice(0, 6);
  const maxRevenue = Math.max(1, ...stats.months.map((m) => m.revenue));
  const team = employees.filter((e) => e.active && e.id !== meId);

  return (
    <>
      <TeamCard team={team} taskLoad={taskLoad} />

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

      {overdue.length > 0 ? (
        <Card className="border-destructive/40 mt-4">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              Verzug — überfällige Aufgaben ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {overdue.slice(0, 12).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <Link href={`/projekte/${t.project_id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {t.project_title ?? "Projekt"}
                      {t.assignee_name ? ` · ${t.assignee_name}` : " · nicht zugewiesen"}
                    </span>
                  </span>
                  <span className="text-destructive text-xs">
                    {t.due_date ? formatDate(t.due_date) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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

async function EmployeeDashboard({
  employeeId,
  readOnly = false,
}: {
  employeeId: string | null;
  readOnly?: boolean;
}) {
  const [projects, tasks, events, inbox] = await Promise.all([
    getProjects(),
    employeeId ? getMyOpenTasks(employeeId) : Promise.resolve([]),
    employeeId ? listUpcomingEvents(employeeId) : Promise.resolve([]),
    employeeId
      ? getInbox(employeeId)
      : Promise.resolve({ offered: [], unread: [], overdue: [], total: 0 }),
  ]);
  const myProjects = projects.filter((p) => p.assigned_employee_id === employeeId);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Offene Aufgaben" value={formatNumber(tasks.length, 0)} icon={TrendingUp} />
        <Kpi label="Dir angeboten" value={formatNumber(inbox.offered.length, 0)} icon={UserPlus} />
        <Kpi label="Ungelesen" value={formatNumber(inbox.unread.length, 0)} icon={MessageSquare} />
        <Kpi label="Meine Projekte" value={formatNumber(myProjects.length, 0)} icon={FolderKanban} href="/projekte" />
      </div>

      {inbox.total > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Posteingang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inbox.overdue.length > 0 ? (
              <InboxGroup title="Überfällig" items={inbox.overdue} />
            ) : null}
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
            <MyTasksPanel tasks={tasks} currentEmployeeId={employeeId} readOnly={readOnly} />
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

function initials(name: string | null, email: string | null): string {
  const base = (name ?? email ?? "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/**
 * Team-Übersicht (nur Admin): alle aktiven Mitarbeiter mit ihrer Aufgaben-
 * last und einem Sprung in die read-only „Sicht ansehen". Ersetzt das früher
 * leicht übersehene Dropdown im Header.
 */
function TeamCard({
  team,
  taskLoad,
}: {
  team: Employee[];
  taskLoad: Record<string, EmployeeTaskLoad>;
}) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" /> Team
        </CardTitle>
      </CardHeader>
      <CardContent>
        {team.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Noch keine weiteren aktiven Mitarbeiter. Lege unter{" "}
            <Link href="/mitarbeiter" className="text-primary hover:underline">
              Mitarbeiter
            </Link>{" "}
            Kollegen an, um ihre Sicht und Aufgaben einsehen zu können.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {team.map((e) => {
              const load = taskLoad[e.id] ?? { open: 0, overdue: 0 };
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg border p-2.5"
                >
                  <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {initials(e.name, e.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {e.name ?? e.email ?? "Mitarbeiter"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {e.role === "admin" ? "Admin" : "Mitarbeiter"}
                      {e.is_sales ? " · Vertrieb" : ""} · {load.open} offen
                      {load.overdue > 0 ? (
                        <span className="text-destructive"> · {load.overdue} überfällig</span>
                      ) : null}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard?as=${e.id}`}>
                      <Eye className="size-4" /> Sicht ansehen
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
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
            <span
              className={
                "ml-2 text-xs " +
                (it.reason === "überfällig" ? "text-destructive" : "text-muted-foreground")
              }
            >
              {it.reason === "angeboten"
                ? "annehmen?"
                : it.reason === "überfällig"
                  ? "überfällig"
                  : "neue Nachricht"}
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

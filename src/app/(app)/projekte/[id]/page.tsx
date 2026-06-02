import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectFormDialog } from "@/components/projekte/project-form-dialog";
import { AddProjectActivityForm } from "@/components/projekte/add-project-activity-form";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { LocationMap } from "@/components/shared/location-map";
import {
  getProject,
  getProjectActivities,
} from "@/lib/data/projects";
import { getCustomers, getCustomer } from "@/lib/data/customers";
import { getEmployees } from "@/lib/data/employees";
import { getCalculationsByProject } from "@/lib/data/calculations";
import { getOffersByProject } from "@/lib/data/offers";
import { getDocumentsByProject } from "@/lib/data/documents";
import { getProjectTasks, getTaskCandidatesByProject, getTaskDeps } from "@/lib/data/workflow";
import { getCurrentEmployee } from "@/lib/supabase/auth";
import { getTimeEntriesByProject } from "@/lib/data/time";
import { getProjectFiles } from "@/lib/data/project-files";
import { ProjectFileDrop } from "@/components/projekte/project-file-drop";
import { getMeasurements } from "@/lib/data/measurements";
import { AufmassCard } from "@/components/projekte/aufmass-card";
import { getSiteLog } from "@/lib/data/site-log";
import { SiteLogCard } from "@/components/projekte/site-log-card";
import { getLaborRate } from "@/lib/data/settings";
import { TaskList } from "@/components/projekte/task-list";
import { InvoiceActions } from "@/components/dokumente/invoice-actions";
import { RueckfrageDialog } from "@/components/projekte/rueckfrage-dialog";
import { deleteProject } from "@/app/(app)/projekte/actions";
import { createOfferFromCalculation } from "@/app/(app)/angebot/actions";
import { createDeliveryNote } from "@/app/(app)/dokumente/actions";
import { customerName, formatCurrency, formatNumber } from "@/lib/format";
import { offerStatusVariant, statusVariant } from "@/lib/constants";

export const metadata: Metadata = { title: "Projekt" };

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value || "–"}</dd>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [
    activities,
    customers,
    employees,
    variants,
    fullCustomer,
    offers,
    auftraege,
    lieferscheine,
    rechnungen,
  ] = await Promise.all([
    getProjectActivities(id),
    getCustomers(),
    getEmployees(),
    getCalculationsByProject(id),
    project.customer_id ? getCustomer(project.customer_id) : null,
    getOffersByProject(id),
    getDocumentsByProject(id, "auftragsbestaetigung"),
    getDocumentsByProject(id, "lieferschein"),
    getDocumentsByProject(id, "rechnung"),
  ]);
  const [tasks, taskCandidates, timeEntries, laborRate, me, projectFiles, measurements, siteLog] =
    await Promise.all([
      getProjectTasks(id),
      getTaskCandidatesByProject(id),
      getTimeEntriesByProject(id),
      getLaborRate(),
      getCurrentEmployee(),
      getProjectFiles(id),
      getMeasurements(id),
      getSiteLog(id),
    ]);
  // Kandidaten je Aufgabe (für „angeboten an …" und „Annehmen").
  const candidatesByTask: Record<string, string[]> = {};
  for (const c of taskCandidates) {
    (candidatesByTask[c.task_id] ??= []).push(c.employee_id);
  }

  // Vorgänger je Aufgabe (für „wartet auf …" und die Blockierung).
  const taskDeps = await getTaskDeps(tasks.map((t) => t.id));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const predsByTask: Record<string, { id: string; title: string; done: boolean }[]> = {};
  for (const d of taskDeps) {
    const pred = taskById.get(d.depends_on_task_id);
    if (pred)
      (predsByTask[d.task_id] ??= []).push({
        id: pred.id,
        title: pred.title,
        done: pred.status === "erledigt",
      });
  }

  // Nachkalkulation: Ist-Arbeitskosten aus erfassten Stunden × Satz
  // (Eintrag > Mitarbeiter-Satz > globaler Satz).
  const costRateByEmployee = new Map(
    employees.map((e) => [e.id, e.cost_rate ?? null]),
  );
  let istHours = 0;
  let istLaborCost = 0;
  for (const e of timeEntries) {
    const h = Number(e.hours) || 0;
    istHours += h;
    const rate =
      e.hourly_rate ??
      (e.employee_id ? costRateByEmployee.get(e.employee_id) : null) ??
      laborRate;
    istLaborCost += h * rate;
  }
  // Referenz-Angebot: bevorzugt angenommen, sonst das neueste.
  const refOffer = offers.find((o) => o.status === "Angenommen") ?? offers[0];
  const offNetto =
    typeof refOffer?.totals?.netto === "number" ? (refOffer.totals.netto as number) : 0;
  const offEk =
    typeof refOffer?.totals?.ekGesamt === "number"
      ? (refOffer.totals.ekGesamt as number)
      : 0;
  const planDb =
    typeof refOffer?.totals?.marge === "number" ? (refOffer.totals.marge as number) : 0;
  const istDb = offNetto - offEk - istLaborCost;

  const customerAddress = fullCustomer
    ? [
        fullCustomer.street,
        [fullCustomer.zip, fullCustomer.city].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const address = [
    project.street,
    [project.zip, project.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projekte">
            <ArrowLeft className="size-4" /> Zurück zur Liste
          </Link>
        </Button>
      </div>

      <PageHeader title={project.title ?? "Projekt"}>
        <Badge variant={statusVariant(project.status)}>
          {project.status ?? "–"}
        </Badge>
        <ProjectFormDialog
          project={project}
          customers={customers}
          employees={employees}
          trigger={
            <Button variant="outline">
              <Pencil className="size-4" /> Bearbeiten
            </Button>
          }
        />
        <form action={deleteProject}>
          <input type="hidden" name="id" value={project.id} />
          <Button variant="ghost" size="icon" type="submit" title="Löschen">
            <Trash2 className="size-4" />
          </Button>
        </form>
      </PageHeader>

      {project.system_size_kwp || project.storage_kwh ? (
        <div className="mb-4 grid grid-cols-2 gap-4 sm:max-w-md">
          <Card>
            <CardContent className="py-4">
              <p className="text-muted-foreground text-xs">Anlagenleistung</p>
              <p className="text-2xl font-semibold">
                {formatNumber(project.system_size_kwp)}{" "}
                <span className="text-muted-foreground text-base font-normal">
                  kWp
                </span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-muted-foreground text-xs">Speicher</p>
              <p className="text-2xl font-semibold">
                {formatNumber(project.storage_kwh)}{" "}
                <span className="text-muted-foreground text-base font-normal">
                  kWh
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Kalkulationen{" "}
              <span className="text-muted-foreground font-normal">
                ({variants.length})
              </span>
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/kalkulation/${project.id}`}>Öffnen</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {variants.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Noch keine Kalkulation.
              </p>
            ) : (
              <ul className="divide-y">
                {variants.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/kalkulation/${project.id}?calc=${v.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {v.is_selected ? "★ " : ""}
                      {v.name ?? "Variante"}
                      <span className="text-muted-foreground ml-1 font-normal">
                        {v.system_size_kwp
                          ? `${formatNumber(v.system_size_kwp)} kWp`
                          : ""}
                        {v.storage_kwh
                          ? ` / ${formatNumber(v.storage_kwh)} kWh`
                          : ""}
                      </span>
                    </Link>
                    <form action={createOfferFromCalculation}>
                      <input type="hidden" name="calc_id" value={v.id} />
                      <input
                        type="hidden"
                        name="project_id"
                        value={project.id}
                      />
                      <Button variant="ghost" size="sm" type="submit">
                        Angebot erstellen
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Angebote{" "}
              <span className="text-muted-foreground font-normal">
                ({offers.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {offers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Noch keine Angebote. Über die Schaltfläche bei einer Variante
                anlegen.
              </p>
            ) : (
              <ul className="divide-y">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <Link
                      href={`/angebot/${o.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Nr. {o.offer_number ?? "–"} · {o.title ?? "Angebot"}
                      <span className="text-muted-foreground ml-1 font-normal">
                        {typeof o.totals?.brutto === "number"
                          ? formatCurrency(o.totals.brutto)
                          : ""}
                      </span>
                    </Link>
                    <Badge variant={offerStatusVariant(o.status)}>
                      {o.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projektablauf / Aufgaben */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Projektablauf</CardTitle>
          <RueckfrageDialog projectId={id} employees={employees} />
        </CardHeader>
        <CardContent>
          <TaskList
            projectId={id}
            tasks={tasks}
            employees={employees}
            candidatesByTask={candidatesByTask}
            predsByTask={predsByTask}
            currentEmployeeId={me?.id ?? null}
          />
        </CardContent>
      </Card>

      {/* Aufmaß */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Aufmaß</CardTitle>
        </CardHeader>
        <CardContent>
          <AufmassCard projectId={id} measurements={measurements} />
        </CardContent>
      </Card>

      {/* Bautagebuch */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Bautagebuch</CardTitle>
        </CardHeader>
        <CardContent>
          <SiteLogCard projectId={id} entries={siteLog} />
        </CardContent>
      </Card>

      {/* Projekt-Dateien (Datenblätter, Handbücher, Pläne) */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Dateien</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectFileDrop projectId={id} files={projectFiles} />
        </CardContent>
      </Card>

      {/* Stunden & Nachkalkulation */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Stunden & Nachkalkulation</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/zeiterfassung">Stunden erfassen</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {refOffer ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Geleistete Stunden" value={`${formatNumber(istHours)} Std`} />
              <Field label="Ist-Arbeitskosten" value={formatCurrency(istLaborCost)} />
              <Field label="Plan-DB (Angebot)" value={formatCurrency(planDb)} />
              <Field
                label="Ist-DB (nach Lohn)"
                value={`${formatCurrency(istDb)} (${formatNumber(
                  offNetto > 0 ? (istDb / offNetto) * 100 : 0,
                  1,
                )} %)`}
              />
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">
              {formatNumber(istHours)} Std erfasst. Für die Nachkalkulation ein
              Angebot anlegen (liefert Erlös & Material-EK).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Folgedokumente: Auftragsbestätigungen, Lieferscheine & Rechnungen */}
      {offers.length > 0 ||
      auftraege.length > 0 ||
      lieferscheine.length > 0 ||
      rechnungen.length > 0 ? (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aufträge</CardTitle>
            </CardHeader>
            <CardContent>
              {auftraege.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Noch keine Auftragsbestätigung. Bei einem angenommenen Angebot
                  oben „Auftragsbestätigung“ erstellen.
                </p>
              ) : (
                <ul className="divide-y">
                  {auftraege.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <Link
                        href={`/auftrag/${d.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        AB Nr. {d.doc_number ?? "–"}
                      </Link>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{d.status}</Badge>
                        <InvoiceActions sourceId={d.id} />
                        <form action={createDeliveryNote}>
                          <input type="hidden" name="document_id" value={d.id} />
                          <Button variant="ghost" size="sm" type="submit">
                            Lieferschein
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lieferscheine</CardTitle>
            </CardHeader>
            <CardContent>
              {lieferscheine.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Noch keine Lieferscheine.
                </p>
              ) : (
                <ul className="divide-y">
                  {lieferscheine.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <Link
                        href={`/lieferschein/${d.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        LS Nr. {d.doc_number ?? "–"}
                      </Link>
                      <Badge variant="outline">{d.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rechnungen</CardTitle>
            </CardHeader>
            <CardContent>
              {rechnungen.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Noch keine Rechnungen. Bei einer Auftragsbestätigung oben über
                  „Rechnung“ eine Abschlags-, Schluss- oder Vollrechnung erstellen.
                </p>
              ) : (
                <ul className="divide-y">
                  {rechnungen.map((d) => {
                    const overdue =
                      d.payment_status !== "bezahlt" &&
                      d.due_date != null &&
                      d.due_date < new Date().toISOString().slice(0, 10);
                    return (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <Link
                          href={`/rechnung/${d.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {d.title ?? "Rechnung"} Nr. {d.doc_number ?? "–"}
                        </Link>
                        <Badge
                          variant={
                            d.payment_status === "bezahlt"
                              ? "default"
                              : overdue
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {d.payment_status === "bezahlt"
                            ? "bezahlt"
                            : overdue
                              ? "überfällig"
                              : "offen"}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {fullCustomer ? (
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Kunde</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/kunden/${fullCustomer.id}`}>Kundenakte öffnen</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field
                label="Kundennr."
                value={
                  fullCustomer.customer_nr
                    ? String(fullCustomer.customer_nr)
                    : "–"
                }
              />
              <Field label="Typ" value={fullCustomer.kind} />
              <Field
                label="Name"
                value={
                  [
                    fullCustomer.salutation,
                    fullCustomer.academic_title,
                    fullCustomer.first_name,
                    fullCustomer.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ") || "–"
                }
              />
              <Field label="Firma" value={fullCustomer.company} />
              <Field label="Wohnort / Adresse" value={customerAddress} />
              <div>
                <dt className="text-muted-foreground text-xs">Telefon</dt>
                <dd className="text-sm">
                  {fullCustomer.phone ? (
                    <a className="hover:underline" href={`tel:${fullCustomer.phone}`}>
                      {fullCustomer.phone}
                    </a>
                  ) : (
                    "–"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Mobil</dt>
                <dd className="text-sm">
                  {fullCustomer.mobile ? (
                    <a className="hover:underline" href={`tel:${fullCustomer.mobile}`}>
                      {fullCustomer.mobile}
                    </a>
                  ) : (
                    "–"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">E-Mail</dt>
                <dd className="text-sm">
                  {fullCustomer.email ? (
                    <a
                      className="hover:underline"
                      href={`mailto:${fullCustomer.email}`}
                    >
                      {fullCustomer.email}
                    </a>
                  ) : (
                    "–"
                  )}
                </dd>
              </div>
            </dl>
            {fullCustomer.notes ? (
              <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
                {fullCustomer.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Projektdaten</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              <Field
                label="Kunde"
                value={project.customer ? customerName(project.customer) : "–"}
              />
              <Field label="Status" value={project.status} />
              <Field label="Anlagentyp" value={project.project_type ?? "–"} />
              <Field
                label="Anlagengröße"
                value={
                  project.system_size_kwp
                    ? `${formatNumber(project.system_size_kwp)} kWp`
                    : "–"
                }
              />
              <Field
                label="Speicher"
                value={
                  project.storage_kwh
                    ? `${formatNumber(project.storage_kwh)} kWh`
                    : "–"
                }
              />
              <Field label="Montageort" value={address} />
            </dl>
            {project.customer ? (
              <Button variant="link" className="mt-2 h-auto p-0" asChild>
                <Link href={`/kunden/${project.customer.id}`}>
                  Zum Kunden →
                </Link>
              </Button>
            ) : null}
            {project.notes ? (
              <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
                {project.notes}
              </p>
            ) : null}
            {project.lat != null && project.lon != null ? (
              <div className="mt-4">
                <LocationMap
                  lat={project.lat}
                  lon={project.lon}
                  label={address || project.title || "Montageort"}
                />
              </div>
            ) : address ? (
              <p className="text-muted-foreground mt-4 text-xs">
                Keine Koordinaten — Projekt mit Adresse speichern, um die Karte zu
                laden.{" "}
                <a
                  className="underline"
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Auf OpenStreetMap suchen
                </a>
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Logbuch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AddProjectActivityForm
              projectId={project.id}
              customerId={project.customer_id}
            />
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

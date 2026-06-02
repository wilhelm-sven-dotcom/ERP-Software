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
import { deleteProject } from "@/app/(app)/projekte/actions";
import { customerName, formatNumber } from "@/lib/format";
import { statusVariant } from "@/lib/constants";

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

  const [activities, customers, employees, variants, fullCustomer] =
    await Promise.all([
      getProjectActivities(id),
      getCustomers(),
      getEmployees(),
      getCalculationsByProject(id),
      project.customer_id ? getCustomer(project.customer_id) : null,
    ]);
  const selectedVariant =
    variants.find((v) => v.is_selected) ??
    (variants.length === 1 ? variants[0] : null);

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

      <p className="text-muted-foreground mb-4 text-sm">
        {selectedVariant ? (
          <>
            Gewählte Kalkulation:{" "}
            <Link
              href={`/kalkulation/${project.id}?calc=${selectedVariant.id}`}
              className="text-foreground font-medium hover:underline"
            >
              {selectedVariant.name ?? "Standard"}
            </Link>
            {variants.length > 1 ? ` (${variants.length} Varianten)` : ""}
          </>
        ) : (
          <Link
            href={`/kalkulation/${project.id}`}
            className="hover:underline"
          >
            Kalkulation öffnen
          </Link>
        )}
      </p>

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

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerFormDialog } from "@/components/kunden/customer-form-dialog";
import { AddActivityForm } from "@/components/kunden/add-activity-form";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { getCustomer, getCustomerActivities } from "@/lib/data/customers";
import { deleteCustomer } from "@/app/(app)/kunden/actions";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Kunde" };

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value || "–"}</dd>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, activities] = await Promise.all([
    getCustomer(id),
    getCustomerActivities(id),
  ]);
  if (!customer) notFound();
  const address = [
    customer.street,
    [customer.zip, customer.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kunden">
            <ArrowLeft className="size-4" /> Zurück zur Liste
          </Link>
        </Button>
      </div>

      <PageHeader
        title={customerName(customer)}
        description={
          [
            customer.customer_nr ? `Kundennummer ${customer.customer_nr}` : null,
            customer.kind ? `Typ: ${customer.kind}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      >
        <CustomerFormDialog
          customer={customer}
          trigger={
            <Button variant="outline">
              <Pencil className="size-4" /> Bearbeiten
            </Button>
          }
        />
        <form action={deleteCustomer}>
          <input type="hidden" name="id" value={customer.id} />
          <Button variant="ghost" size="icon" type="submit" title="Löschen">
            <Trash2 className="size-4" />
          </Button>
        </form>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Stammdaten</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Firma" value={customer.company} />
              <Field label="Anrede" value={customer.salutation} />
              <Field label="Vorname" value={customer.first_name} />
              <Field label="Nachname" value={customer.last_name} />
              <Field label="E-Mail" value={customer.email} />
              <Field label="Telefon" value={customer.phone} />
              <Field label="Mobil" value={customer.mobile} />
              <Field label="Adresse" value={address} />
            </dl>
            {customer.notes ? (
              <p className="text-muted-foreground mt-4 text-sm whitespace-pre-wrap">
                {customer.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AddActivityForm customerId={customer.id} />
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

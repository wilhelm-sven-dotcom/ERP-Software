import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { ServiceBoard } from "@/components/service/service-board";
import { ServiceCardDialog } from "@/components/service/service-card-dialog";
import { TrelloImportDialog } from "@/components/service/trello-import-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getServiceTickets } from "@/lib/data/service";
import { getEmployees } from "@/lib/data/employees";
import { getCustomers } from "@/lib/data/customers";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Service" };

export default async function ServicePage() {
  const [tickets, employees, customers] = await Promise.all([
    getServiceTickets(),
    getEmployees(),
    getCustomers(),
  ]);
  const employeeOptions = employees
    .filter((e) => e.active)
    .map((e) => ({ id: e.id, name: e.name ?? e.email ?? "Mitarbeiter" }));
  const customerOptions = customers.map((c) => ({ id: c.id, name: customerName(c) }));

  return (
    <div>
      <PageHeader title="Service" description="Service-Aufträge als Kanban-Board.">
        <div className="flex items-center gap-2">
          <TrelloImportDialog />
          <ServiceCardDialog
            employees={employeeOptions}
            customers={customerOptions}
            trigger={
              <Button>
                <Plus className="size-4" /> Neue Karte
              </Button>
            }
          />
        </div>
      </PageHeader>
      <SupabaseNotice />

      {tickets.length === 0 ? (
        <EmptyState
          title="Noch keine Service-Karten"
          description="Lege eine Karte an oder importiere euer Trello-Board."
        />
      ) : (
        <ServiceBoard tickets={tickets} employees={employeeOptions} customers={customerOptions} />
      )}
    </div>
  );
}

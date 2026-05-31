import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeRowForm } from "@/components/mitarbeiter/employee-row-form";
import { getEmployees } from "@/lib/data/employees";
import { getCurrentEmployee } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Mitarbeiter" };

export default async function MitarbeiterPage() {
  const [employees, me] = await Promise.all([
    getEmployees(),
    getCurrentEmployee(),
  ]);
  const isAdmin = me?.role === "admin";

  return (
    <div>
      <PageHeader
        title="Mitarbeiter"
        description={
          isAdmin
            ? "Rollen verwalten. Neue Mitarbeiter melden sich per Login an und erscheinen automatisch hier."
            : "Übersicht der Mitarbeiter. Verwaltung nur für Administratoren."
        }
      />

      <SupabaseNotice />

      {employees.length === 0 ? (
        <EmptyState
          title="Noch keine Mitarbeiter"
          description="Sobald sich jemand per Login anmeldet, wird automatisch ein Mitarbeitereintrag angelegt."
        />
      ) : (
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <EmployeeRowForm key={e.id} employee={e} canEdit={isAdmin} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

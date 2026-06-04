import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { EmployeeDetail } from "@/components/mitarbeiter/employee-detail";
import { getEmployee, getContracts, getAbsences, vacationBalance } from "@/lib/data/hr";
import { getCurrentEmployee } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Mitarbeiter" };

export default async function MitarbeiterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [employee, me] = await Promise.all([getEmployee(id), getCurrentEmployee()]);
  if (!employee) notFound();

  const isAdmin = me?.role === "admin";
  const isSelf = me?.id === id;
  // Sichtbar nur für Admin oder die eigene Person (RLS schützt zusätzlich).
  if (!isAdmin && !isSelf) {
    return (
      <div>
        <PageHeader title="Mitarbeiter" />
        <p className="text-muted-foreground text-sm">Keine Berechtigung für diese Personalakte.</p>
      </div>
    );
  }

  const [contracts, absences] = await Promise.all([getContracts(id), getAbsences(id)]);
  const balance = vacationBalance(employee, absences);
  const title = [employee.first_name, employee.last_name].filter(Boolean).join(" ") || employee.name || employee.email || "Mitarbeiter";

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/mitarbeiter">
            <ArrowLeft className="size-4" /> Zur Übersicht
          </Link>
        </Button>
      </div>
      <PageHeader title={title} description={employee.position ?? employee.email ?? undefined} />
      <SupabaseNotice />
      <EmployeeDetail
        employee={employee}
        contracts={contracts}
        absences={absences}
        balance={balance}
        isAdmin={isAdmin}
      />
    </div>
  );
}

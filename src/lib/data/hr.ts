import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Employee, EmployeeContract, EmployeeAbsence } from "@/lib/types";

const EMP_SELECT =
  "id, auth_user_id, name, first_name, last_name, email, role, active, is_sales, cost_rate, " +
  "birth_date, start_date, street, zip, city, phone, mobile, position, emergency_contact, " +
  "vacation_days_per_year, created_at, updated_at";

export async function getEmployee(id: string): Promise<Employee | null> {
  if (!isSupabaseConfigured() || !id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select(EMP_SELECT).eq("id", id).maybeSingle();
  if (error) {
    console.error("getEmployee:", error.message);
    return null;
  }
  return (data as unknown as Employee) ?? null;
}

export async function getContracts(employeeId: string): Promise<EmployeeContract[]> {
  if (!isSupabaseConfigured() || !employeeId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_contracts")
    .select("*")
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("getContracts:", error.message);
    return [];
  }
  return (data ?? []) as EmployeeContract[];
}

export async function getAbsences(employeeId: string): Promise<EmployeeAbsence[]> {
  if (!isSupabaseConfigured() || !employeeId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employee_absences")
    .select("*")
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false });
  if (error) {
    console.error("getAbsences:", error.message);
    return [];
  }
  return (data ?? []) as EmployeeAbsence[];
}

export interface VacationBalance {
  entitlement: number;
  taken: number;
  pending: number;
  remaining: number;
  year: number;
}

/** Urlaubskonto im laufenden Jahr: Anspruch − genehmigte Urlaubstage. */
export function vacationBalance(
  employee: Employee,
  absences: EmployeeAbsence[],
  year = new Date().getFullYear(),
): VacationBalance {
  const entitlement = employee.vacation_days_per_year ?? 30;
  const inYear = (a: EmployeeAbsence) =>
    a.absence_type === "urlaub" && a.start_date.slice(0, 4) === String(year);
  const taken = absences
    .filter((a) => inYear(a) && a.status === "approved")
    .reduce((s, a) => s + (Number(a.days) || 0), 0);
  const pending = absences
    .filter((a) => inYear(a) && a.status === "pending")
    .reduce((s, a) => s + (Number(a.days) || 0), 0);
  return { entitlement, taken, pending, remaining: entitlement - taken, year };
}

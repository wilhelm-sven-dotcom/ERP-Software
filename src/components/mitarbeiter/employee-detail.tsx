"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  saveEmployee,
  saveContract,
  deleteContract,
  saveAbsence,
  decideAbsence,
  deleteAbsence,
} from "@/app/(app)/mitarbeiter/actions";
import { type ActionResult } from "@/lib/actions";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { Employee, EmployeeContract, EmployeeAbsence } from "@/lib/types";
import type { VacationBalance } from "@/lib/data/hr";

const initial: ActionResult = { ok: false };

function useSavedToast(state: ActionResult, msg: string) {
  const router = useRouter();
  const seen = React.useRef<ActionResult | null>(null);
  React.useEffect(() => {
    if (seen.current === state) return; // jedes Ergebnis nur einmal verarbeiten
    seen.current = state;
    if (state.ok) {
      toast.success(msg);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, msg, router]);
}

const ABSENCE_LABEL: Record<string, string> = {
  urlaub: "Urlaub",
  krank: "Krank",
  fortbildung: "Fortbildung",
  unbezahlt: "Unbezahlt",
  sonstiges: "Sonstiges",
};

export function EmployeeDetail({
  employee,
  contracts,
  absences,
  balance,
  isAdmin,
}: {
  employee: Employee;
  contracts: EmployeeContract[];
  absences: EmployeeAbsence[];
  balance: VacationBalance;
  isAdmin: boolean;
}) {
  return (
    <Tabs defaultValue="stammdaten">
      <TabsList>
        <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
        <TabsTrigger value="vertraege">Verträge</TabsTrigger>
        <TabsTrigger value="abwesenheiten">Abwesenheiten</TabsTrigger>
      </TabsList>
      <TabsContent value="stammdaten" className="mt-4">
        <Stammdaten employee={employee} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="vertraege" className="mt-4">
        <Contracts employeeId={employee.id} contracts={contracts} isAdmin={isAdmin} />
      </TabsContent>
      <TabsContent value="abwesenheiten" className="mt-4">
        <Absences employeeId={employee.id} absences={absences} balance={balance} isAdmin={isAdmin} />
      </TabsContent>
    </Tabs>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{value || "–"}</dd>
    </div>
  );
}

function Stammdaten({ employee, isAdmin }: { employee: Employee; isAdmin: boolean }) {
  const [state, action, pending] = useActionState(saveEmployee, initial);
  useSavedToast(state, "Gespeichert");

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Vorname" value={employee.first_name} />
            <Field label="Nachname" value={employee.last_name} />
            <Field label="E-Mail" value={employee.email} />
            <Field label="Position" value={employee.position} />
            <Field label="Telefon" value={employee.phone} />
            <Field label="Mobil" value={employee.mobile} />
            <Field label="Adresse" value={[employee.street, [employee.zip, employee.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
            <Field label="Eintritt" value={employee.start_date ? formatDate(employee.start_date) : null} />
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="id" value={employee.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Lbl label="Vorname"><Input name="first_name" defaultValue={employee.first_name ?? ""} required /></Lbl>
            <Lbl label="Nachname"><Input name="last_name" defaultValue={employee.last_name ?? ""} /></Lbl>
            <Lbl label="Position"><Input name="position" defaultValue={employee.position ?? ""} /></Lbl>
            <Lbl label="Telefon"><Input name="phone" defaultValue={employee.phone ?? ""} /></Lbl>
            <Lbl label="Mobil"><Input name="mobile" defaultValue={employee.mobile ?? ""} /></Lbl>
            <Lbl label="Geburtsdatum"><Input name="birth_date" type="date" defaultValue={employee.birth_date ?? ""} /></Lbl>
            <Lbl label="Straße"><Input name="street" defaultValue={employee.street ?? ""} /></Lbl>
            <Lbl label="PLZ"><Input name="zip" defaultValue={employee.zip ?? ""} /></Lbl>
            <Lbl label="Ort"><Input name="city" defaultValue={employee.city ?? ""} /></Lbl>
            <Lbl label="Eintrittsdatum"><Input name="start_date" type="date" defaultValue={employee.start_date ?? ""} /></Lbl>
            <Lbl label="Notfallkontakt"><Input name="emergency_contact" defaultValue={employee.emergency_contact ?? ""} /></Lbl>
            <Lbl label="Urlaubstage/Jahr"><Input name="vacation_days_per_year" type="number" defaultValue={String(employee.vacation_days_per_year ?? 30)} /></Lbl>
            <Lbl label="Stundensatz (€)"><Input name="cost_rate" defaultValue={employee.cost_rate != null ? String(employee.cost_rate) : ""} /></Lbl>
            <Lbl label="Rolle">
              <select name="role" defaultValue={employee.role} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                <option value="mitarbeiter">Mitarbeiter</option>
                <option value="admin">Admin</option>
              </select>
            </Lbl>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={employee.active} className="size-4" /> Aktiv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_sales" defaultChecked={Boolean(employee.is_sales)} className="size-4" /> Vertrieb
              </label>
            </div>
          </div>
          <div>
            <Button type="submit" disabled={pending}>{pending ? "Speichern …" : "Speichern"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Contracts({
  employeeId,
  contracts,
  isAdmin,
}: {
  employeeId: string;
  contracts: EmployeeContract[];
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(saveContract, initial);
  useSavedToast(state, "Vertrag gespeichert");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Verträge</CardTitle></CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch keine Verträge hinterlegt.</p>
          ) : (
            <ul className="divide-y">
              {contracts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium capitalize">
                      {c.contract_type}{" "}
                      <Badge variant={c.status === "aktiv" ? "default" : "outline"}>{c.status}</Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {c.start_date ? formatDate(c.start_date) : "–"}{c.end_date ? ` bis ${formatDate(c.end_date)}` : " (unbefristet)"}
                      {c.weekly_hours != null ? ` · ${formatNumber(c.weekly_hours)} Std/Woche` : ""}
                      {c.salary_monthly != null ? ` · ${formatCurrency(c.salary_monthly)}/Monat` : ""}
                      {c.hourly_rate != null ? ` · ${formatCurrency(c.hourly_rate)}/Std` : ""}
                    </p>
                  </div>
                  {isAdmin ? (
                    <form action={deleteContract}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="employee_id" value={employeeId} />
                      <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Vertrag hinzufügen</CardTitle></CardHeader>
          <CardContent>
            <form action={action} className="grid gap-4">
              <input type="hidden" name="employee_id" value={employeeId} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Lbl label="Art">
                  <select name="contract_type" defaultValue="vollzeit" className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                    <option value="vollzeit">Vollzeit</option>
                    <option value="teilzeit">Teilzeit</option>
                    <option value="minijob">Minijob</option>
                    <option value="freelance">Freelance</option>
                    <option value="ausbildung">Ausbildung</option>
                  </select>
                </Lbl>
                <Lbl label="Beginn"><Input name="start_date" type="date" /></Lbl>
                <Lbl label="Ende (optional)"><Input name="end_date" type="date" /></Lbl>
                <Lbl label="Wochenstunden"><Input name="weekly_hours" type="number" step="0.5" /></Lbl>
                <Lbl label="Gehalt/Monat (€)"><Input name="salary_monthly" type="number" step="0.01" /></Lbl>
                <Lbl label="Stundenlohn (€)"><Input name="hourly_rate" type="number" step="0.01" /></Lbl>
                <Lbl label="Urlaubstage"><Input name="vacation_days" type="number" /></Lbl>
                <Lbl label="Notiz"><Input name="notes" /></Lbl>
              </div>
              <div><Button type="submit" disabled={pending}>{pending ? "Speichern …" : "Vertrag speichern"}</Button></div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Absences({
  employeeId,
  absences,
  balance,
  isAdmin,
}: {
  employeeId: string;
  absences: EmployeeAbsence[];
  balance: VacationBalance;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(saveAbsence, initial);
  useSavedToast(state, isAdmin ? "Abwesenheit erfasst" : "Antrag gestellt");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={`Urlaubsanspruch ${balance.year}`} value={`${balance.entitlement} Tage`} />
        <Kpi label="Genommen/genehmigt" value={`${formatNumber(balance.taken)} Tage`} />
        <Kpi label="Resturlaub" value={`${formatNumber(balance.remaining)} Tage`} tone={balance.remaining < 0 ? "warn" : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Abwesenheiten</CardTitle></CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <p className="text-muted-foreground text-sm">Keine Einträge.</p>
          ) : (
            <ul className="divide-y">
              {absences.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {ABSENCE_LABEL[a.absence_type] ?? a.absence_type}{" "}
                      <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "outline"}>
                        {a.status === "approved" ? "genehmigt" : a.status === "rejected" ? "abgelehnt" : a.status === "pending" ? "offen" : a.status}
                      </Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(a.start_date)} – {formatDate(a.end_date)} · {formatNumber(a.days)} Tag(e)
                      {a.notes ? ` · ${a.notes}` : ""}
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="flex items-center gap-1">
                      {a.status === "pending" ? (
                        <>
                          <form action={decideAbsence}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="employee_id" value={employeeId} />
                            <input type="hidden" name="decision" value="approved" />
                            <Button variant="outline" size="sm" type="submit"><Check className="size-4" /> Genehmigen</Button>
                          </form>
                          <form action={decideAbsence}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="employee_id" value={employeeId} />
                            <input type="hidden" name="decision" value="rejected" />
                            <Button variant="ghost" size="sm" type="submit"><X className="size-4" /></Button>
                          </form>
                        </>
                      ) : null}
                      <form action={deleteAbsence}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="employee_id" value={employeeId} />
                        <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isAdmin ? "Abwesenheit erfassen" : "Urlaub/Abwesenheit beantragen"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <input type="hidden" name="employee_id" value={employeeId} />
            <div className="grid gap-4 sm:grid-cols-4">
              <Lbl label="Art">
                <select name="absence_type" defaultValue="urlaub" className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                  <option value="urlaub">Urlaub</option>
                  <option value="krank">Krank</option>
                  <option value="fortbildung">Fortbildung</option>
                  <option value="unbezahlt">Unbezahlt</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </Lbl>
              <Lbl label="Von"><Input name="start_date" type="date" required /></Lbl>
              <Lbl label="Bis"><Input name="end_date" type="date" required /></Lbl>
              <Lbl label="Tage (optional)"><Input name="days" type="number" step="0.5" placeholder="auto" /></Lbl>
            </div>
            <Lbl label="Notiz"><Input name="notes" /></Lbl>
            <div><Button type="submit" disabled={pending}>{pending ? "Senden …" : isAdmin ? "Erfassen" : "Antrag stellen"}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={tone === "warn" ? "text-destructive text-2xl font-semibold" : "text-2xl font-semibold"}>{value}</p>
      </CardContent>
    </Card>
  );
}

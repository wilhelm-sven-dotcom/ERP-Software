"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { saveEmployee } from "@/app/(app)/mitarbeiter/actions";
import { type ActionResult } from "@/lib/actions";
import type { Employee } from "@/lib/types";

const initial: ActionResult = { ok: false };

export function EmployeeRowForm({
  employee,
  canEdit,
}: {
  employee: Employee;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveEmployee, initial);

  React.useEffect(() => {
    if (state.ok) {
      toast.success("Mitarbeiter gespeichert");
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  if (!canEdit) {
    return (
      <TableRow>
        <TableCell className="font-medium">
          {employee.name ?? "–"}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {employee.email ?? "–"}
        </TableCell>
        <TableCell className="capitalize">
          {employee.role}
          {employee.is_sales ? (
            <span className="text-muted-foreground ml-1 text-xs">· Vertrieb</span>
          ) : null}
        </TableCell>
        <TableCell>{employee.active ? "aktiv" : "inaktiv"}</TableCell>
        <TableCell>
          <Link href={`/mitarbeiter/${employee.id}`} className="text-primary text-sm hover:underline">
            Akte öffnen
          </Link>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={5} className="p-0">
        <form
          action={action}
          className="grid grid-cols-[1fr_1fr_140px_96px_90px_90px_auto] items-center gap-2 px-2 py-1.5"
        >
          <input type="hidden" name="id" value={employee.id} />
          <Input
            name="name"
            defaultValue={employee.name ?? ""}
            placeholder="Name"
            className="h-8"
          />
          <span className="text-muted-foreground truncate text-sm">
            {employee.email ?? "–"}
          </span>
          <Select name="role" defaultValue={employee.role}>
            <SelectTrigger size="sm" className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Input
            name="cost_rate"
            type="number"
            step="0.01"
            defaultValue={employee.cost_rate ?? ""}
            placeholder="€/Std"
            title="Interner Stundensatz (Nachkalkulation)"
            className="h-8"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_sales"
              defaultChecked={employee.is_sales ?? false}
              className="size-4"
            />
            Vertrieb
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={employee.active}
              className="size-4"
            />
            aktiv
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "…" : "Speichern"}
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <Link href={`/mitarbeiter/${employee.id}`}>Akte</Link>
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  );
}

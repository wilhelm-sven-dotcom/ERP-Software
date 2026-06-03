"use client";

import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SELF = "__self__";

/** Admin-Auswahl: die Sicht eines Mitarbeiters einblenden (?as=…). */
export function TeamViewSelect({
  employees,
  current,
}: {
  employees: { id: string; name: string }[];
  current: string | null;
}) {
  const router = useRouter();
  if (employees.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Eye className="text-muted-foreground size-4" />
      <Select
        value={current ?? SELF}
        onValueChange={(v) =>
          router.push(v === SELF ? "/dashboard" : `/dashboard?as=${v}`)
        }
      >
        <SelectTrigger size="sm" className="h-9 w-56">
          <SelectValue placeholder="Mitarbeiter-Sicht ansehen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELF}>Meine Sicht</SelectItem>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

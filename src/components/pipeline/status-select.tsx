"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setProjectStatus } from "@/app/(app)/projekte/actions";
import { PROJECT_STATUSES } from "@/lib/constants";

/** Schneller Status-Wechsel direkt aus der Pipeline-Karte. */
export function StatusSelect({
  projectId,
  status,
}: {
  projectId: string;
  status: string | null;
}) {
  const router = useRouter();

  async function onChange(next: string) {
    const fd = new FormData();
    fd.set("id", projectId);
    fd.set("status", next);
    await setProjectStatus(fd);
    toast.success(`Status: ${next}`);
    router.refresh();
  }

  return (
    <Select defaultValue={status ?? undefined} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-7 w-full text-xs">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((st) => (
          <SelectItem key={st} value={st}>
            {st}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

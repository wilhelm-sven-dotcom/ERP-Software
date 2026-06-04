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
import { setDocumentStatus } from "@/app/(app)/dokumente/actions";
import { DOCUMENT_STATUSES } from "@/lib/constants";

/** Status eines Folgedokuments (AB/Lieferschein) ändern. */
export function DocumentStatusSelect({
  documentId,
  kind,
  status,
}: {
  documentId: string;
  kind: string;
  status: string;
}) {
  const router = useRouter();

  async function onChange(next: string) {
    const fd = new FormData();
    fd.set("id", documentId);
    fd.set("kind", kind);
    fd.set("status", next);
    await setDocumentStatus(fd);
    toast.success(`Status: ${next}`);
    router.refresh();
  }

  return (
    <Select defaultValue={status} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-8 w-40">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {DOCUMENT_STATUSES.map((st) => (
          <SelectItem key={st} value={st}>
            {st}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

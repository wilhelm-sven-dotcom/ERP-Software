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
import { setOfferStatus } from "@/app/(app)/angebot/actions";
import { OFFER_STATUSES } from "@/lib/constants";

/** Status eines Angebots ändern (Entwurf/Versendet/Angenommen/Abgelehnt). */
export function OfferStatusSelect({
  offerId,
  status,
}: {
  offerId: string;
  status: string;
}) {
  const router = useRouter();

  async function onChange(next: string) {
    const fd = new FormData();
    fd.set("id", offerId);
    fd.set("status", next);
    await setOfferStatus(fd);
    toast.success(`Status: ${next}`);
    router.refresh();
  }

  return (
    <Select defaultValue={status} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-8 w-40">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {OFFER_STATUSES.map((st) => (
          <SelectItem key={st} value={st}>
            {st}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

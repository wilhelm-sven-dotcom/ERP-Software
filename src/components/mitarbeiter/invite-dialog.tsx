"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteEmployee } from "@/app/(app)/mitarbeiter/actions";
import { type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function InviteDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(inviteEmployee, initial);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Einladung verschickt");
      setOpen(false);
      router.refresh();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mitarbeiter einladen</DialogTitle>
          <DialogDescription>
            Die Person erhält eine E-Mail und setzt ihr Passwort selbst. Danach
            erscheint sie hier mit der gewählten Rolle.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">E-Mail *</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="name@firma.de"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-first">Vorname *</Label>
              <Input id="invite-first" name="first_name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-last">Nachname</Label>
              <Input id="invite-last" name="last_name" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Rolle</Label>
              <Select name="role" defaultValue="mitarbeiter">
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sende …" : "Einladung senden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

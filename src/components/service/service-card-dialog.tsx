"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload, ImageIcon, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import {
  saveServiceTicket,
  deleteServiceTicket,
  postServiceMessage,
  registerServiceFile,
  setServiceCover,
  deleteServiceFile,
  fetchServiceTicketDetail,
} from "@/app/(app)/service/actions";
import { SERVICE_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { type ActionResult } from "@/lib/actions";
import type { ServiceTicketCard } from "@/lib/types";

const BUCKET = "service-files";
const initial: ActionResult = { ok: false };
type Detail = Awaited<ReturnType<typeof fetchServiceTicketDetail>>;

export function ServiceCardDialog({
  ticket,
  defaultStatus = "Eingang",
  employees,
  customers,
  trigger,
}: {
  ticket?: ServiceTicketCard;
  defaultStatus?: string;
  employees: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(saveServiceTicket, initial);
  const [detail, setDetail] = React.useState<Detail>(null);
  const [busy, setBusy] = React.useState(false);
  const isEdit = Boolean(ticket);

  const loadDetail = React.useCallback(() => {
    if (ticket) void fetchServiceTicketDetail(ticket.id).then(setDetail);
  }, [ticket]);

  React.useEffect(() => {
    if (open) loadDetail();
  }, [open, loadDetail]);

  React.useEffect(() => {
    if (state.ok && open) {
      toast.success("Gespeichert");
      router.refresh();
      if (!isEdit) setOpen(false);
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, open, isEdit, router]);

  async function uploadFiles(list: FileList | File[], asCover = false) {
    if (!ticket) return;
    setBusy(true);
    const supabase = createClient();
    for (const file of Array.from(list)) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${ticket.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) {
        toast.error(`Upload: ${error.message}`);
        continue;
      }
      await registerServiceFile({
        ticketId: ticket.id,
        name: file.name,
        storagePath: path,
        mime: file.type || null,
        size: file.size,
        asCover: asCover && /^image\//.test(file.type),
      });
    }
    setBusy(false);
    loadDetail();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Service-Karte" : "Neue Service-Karte"}</DialogTitle>
        </DialogHeader>

        <form action={action} className="grid gap-3">
          {ticket ? <input type="hidden" name="id" value={ticket.id} /> : null}
          <div className="grid gap-2">
            <Label htmlFor="title">Titel</Label>
            <Input id="title" name="title" defaultValue={ticket?.title ?? ""} required placeholder="z. B. Wechselrichter defekt — Kunde X" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="customer_id">Kunde</Label>
              <Select name="customer_id" defaultValue={ticket?.customer_id ?? undefined}>
                <SelectTrigger id="customer_id" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Ort</Label>
              <Input id="location" name="location" defaultValue={ticket?.location ?? ""} />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select name="status" defaultValue={ticket?.status ?? defaultStatus}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignee_employee_id">Verantwortlich</Label>
              <Select name="assignee_employee_id" defaultValue={ticket?.assignee_employee_id ?? undefined}>
                <SelectTrigger id="assignee_employee_id" className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_date">Fällig</Label>
              <Input id="due_date" name="due_date" type="date" defaultValue={ticket?.due_date ?? ""} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={ticket?.description ?? ""} />
          </div>
          <div className="flex items-center justify-between">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Speichern …" : "Speichern"}
            </Button>
            {ticket ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", ticket.id);
                  void deleteServiceTicket(fd).then(() => {
                    setOpen(false);
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="size-4" /> Löschen
              </Button>
            ) : null}
          </div>
        </form>

        {ticket ? (
          <>
            {/* Anhänge / Fotos */}
            <div className="border-t pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Fotos & Anhänge</p>
                <label className="text-primary inline-flex cursor-pointer items-center gap-1 text-sm">
                  <Upload className="size-4" /> {busy ? "lädt …" : "Hochladen"}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.files) void uploadFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {detail && detail.files.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detail.files.map((f) => (
                    <div key={f.id} className="group relative">
                      {f.mime?.startsWith("image/") && f.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt={f.name} className="size-20 rounded-md border object-cover" />
                      ) : (
                        <a
                          href={f.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-muted grid size-20 place-items-center rounded-md border p-1 text-center text-[10px]"
                        >
                          {f.name}
                        </a>
                      )}
                      <div className="absolute inset-x-0 bottom-0 hidden justify-between gap-1 bg-black/50 p-0.5 group-hover:flex">
                        <form action={setServiceCover}>
                          <input type="hidden" name="id" value={ticket.id} />
                          <input type="hidden" name="path" value={f.storage_path} />
                          <button type="submit" title="Als Titelbild" className="text-white">
                            <ImageIcon className="size-3.5" />
                          </button>
                        </form>
                        <form action={deleteServiceFile}>
                          <input type="hidden" name="id" value={f.id} />
                          <input type="hidden" name="path" value={f.storage_path} />
                          <button type="submit" title="Löschen" className="text-white">
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">Noch keine Anhänge.</p>
              )}
            </div>

            {/* Kommentare */}
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-semibold">Verlauf</p>
              <ul className="mb-2 max-h-48 space-y-2 overflow-y-auto">
                {detail?.messages.map((m) => (
                  <li key={m.id} className="text-sm">
                    <span className="text-muted-foreground text-xs">
                      {m.author?.name ?? "—"} · {formatDate(m.created_at)}
                    </span>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </li>
                ))}
                {detail && detail.messages.length === 0 ? (
                  <li className="text-muted-foreground text-xs">Noch keine Einträge.</li>
                ) : null}
              </ul>
              <CommentForm ticketId={ticket.id} onPosted={() => { loadDetail(); router.refresh(); }} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CommentForm({ ticketId, onPosted }: { ticketId: string; onPosted: () => void }) {
  const [state, action, pending] = useActionState(postServiceMessage, initial);
  const ref = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onPosted();
      state.ok = false;
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onPosted]);
  return (
    <form ref={ref} action={action} className="flex gap-2">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <Input name="body" placeholder="Kommentar …" className="h-9" required />
      <Button type="submit" size="sm" disabled={pending}>
        <Send className="size-4" />
      </Button>
    </form>
  );
}

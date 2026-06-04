"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importTrelloCards, type TrelloImportCard } from "@/app/(app)/service/trello-actions";
import { SERVICE_STATUSES } from "@/lib/constants";

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  due?: string | null;
  closed?: boolean;
  attachments?: { url?: string; name?: string }[];
};
type TrelloExport = { lists?: TrelloList[]; cards?: TrelloCard[] };

/** Schlägt eine Service-Spalte zu einem Trello-Listennamen vor. */
function suggestStatus(listName: string): string {
  const n = listName.toLowerCase();
  const hit = SERVICE_STATUSES.find((s) => s.toLowerCase() === n);
  if (hit) return hit;
  if (n.includes("eingang") || n.includes("inbox") || n.includes("to do")) return "Eingang";
  if (n.includes("arbeit") || n.includes("doing") || n.includes("progress")) return "In Arbeit";
  if (n.includes("extern") || n.includes("warten") || n.includes("wait")) return "Warten auf Extern";
  if (n.includes("termin")) return "Terminiert";
  if (n.includes("behoben") || n.includes("done") || n.includes("fertig") || n.includes("erledigt"))
    return "Behoben";
  if (n.includes("rechnung")) return "Keine Rechnung stellen";
  return "Eingang";
}

export function TrelloImportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<TrelloExport | null>(null);
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? "{}")) as TrelloExport;
        if (!parsed.lists || !parsed.cards) {
          toast.error("Das sieht nicht nach einem Trello-Board-Export aus.");
          return;
        }
        setData(parsed);
        const m: Record<string, string> = {};
        for (const l of parsed.lists) m[l.id] = suggestStatus(l.name);
        setMapping(m);
      } catch {
        toast.error("Datei konnte nicht gelesen werden (kein gültiges JSON).");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function doImport() {
    if (!data) return;
    setBusy(true);
    const cards: TrelloImportCard[] = (data.cards ?? [])
      .filter((c) => !c.closed)
      .map((c) => {
        const attachments = (c.attachments ?? [])
          .map((a) => a.url)
          .filter(Boolean)
          .join("\n");
        const desc = [c.desc, attachments ? `Anhänge:\n${attachments}` : ""]
          .filter(Boolean)
          .join("\n\n");
        return {
          external_id: c.id,
          title: c.name,
          description: desc || null,
          due: c.due ? c.due.slice(0, 10) : null,
          status: mapping[c.idList] ?? "Eingang",
        };
      });
    const res = await importTrelloCards(cards);
    setBusy(false);
    if (res.ok) {
      toast.success(`${res.imported} Karten importiert${res.skipped ? `, ${res.skipped} übersprungen` : ""}.`);
      setOpen(false);
      setData(null);
      router.refresh();
    } else {
      toast.error(res.error ?? "Import fehlgeschlagen.");
    }
  }

  const openLists = (data?.lists ?? []).filter((l) => !l.closed);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setData(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="size-4" /> Aus Trello importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trello-Board importieren</DialogTitle>
          <DialogDescription>
            In Trello: Board-Menü → „Drucken, Exportieren & Teilen" → „Als JSON exportieren".
            Die heruntergeladene Datei hier hochladen und die Listen den Spalten zuordnen.
          </DialogDescription>
        </DialogHeader>

        <input type="file" accept=".json,application/json" onChange={onFile} className="text-sm" />

        {data ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              {openLists.length} Listen · {(data.cards ?? []).filter((c) => !c.closed).length} Karten
            </p>
            {openLists.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                <Select
                  value={mapping[l.id]}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [l.id]: v }))}
                >
                  <SelectTrigger size="sm" className="h-8 w-52">
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
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={doImport} disabled={busy || !data}>
            {busy ? "Importiere …" : "Importieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

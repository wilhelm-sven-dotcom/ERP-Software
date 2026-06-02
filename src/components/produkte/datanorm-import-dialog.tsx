"use client";

import * as React from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importProducts, type CsvProductRow } from "@/app/(app)/produkte/actions";

/**
 * Best-effort-Parser für DATANORM 4.0 Artikel-Sätze ("A;…", semikolon-getrennt).
 * Layout (gängig): 0='A' 1=Satzkennung 2=Artikelnr 3=Textkennzeichen
 * 4=Kurztext1 5=Kurztext2 6=Preiskennzeichen 7=Preis(in Cent) … 11=Mengeneinheit.
 * Preise in DATANORM stehen i. d. R. in der kleinsten Einheit (Cent) → /100.
 */
function parseDatanorm(text: string): CsvProductRow[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const rows: CsvProductRow[] = [];
  for (const line of lines) {
    if (!/^A;/.test(line)) continue;
    const f = line.split(";");
    const artikelnr = (f[2] ?? "").trim();
    const name = [f[4], f[5]].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
    if (!name && !artikelnr) continue;
    const rawPrice = (f[7] ?? "").trim().replace(",", ".");
    let ek = "";
    const cents = Number(rawPrice);
    if (Number.isFinite(cents) && rawPrice !== "") {
      // Ganzzahl → Cent; bereits dezimal → direkt übernehmen.
      ek = rawPrice.includes(".") ? cents.toFixed(2) : (cents / 100).toFixed(2);
    }
    const einheit = (f[11] ?? "").trim();
    rows.push({
      name: name || artikelnr,
      hersteller: "",
      kategorie: "",
      artikelnr,
      einheit,
      ek,
      vk: "",
      gruppe: "",
    } as CsvProductRow);
  }
  return rows;
}

export function DatanormImportDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<CsvProductRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseDatanorm(String(reader.result ?? ""));
      if (parsed.length === 0) {
        toast.error("Keine DATANORM-Artikelsätze (A;…) gefunden.");
        return;
      }
      setRows(parsed);
    };
    // DATANORM ist häufig latin1-kodiert.
    reader.readAsText(file, "latin1");
  }

  async function onImport() {
    setBusy(true);
    const res = await importProducts(rows);
    setBusy(false);
    if (res.ok) {
      toast.success(
        `${res.imported} Produkte importiert${res.skipped ? `, ${res.skipped} übersprungen` : ""}.`,
      );
      setOpen(false);
      setRows([]);
      router.refresh();
    } else {
      toast.error(res.error ?? "Import fehlgeschlagen.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setRows([]);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>DATANORM importieren</DialogTitle>
          <DialogDescription>
            Artikelstammdaten aus einer DATANORM-Datei (z. B. DATANORM.001) des
            Großhändlers. Best-effort für DATANORM 4.0 — bitte die Vorschau prüfen.
          </DialogDescription>
        </DialogHeader>

        <input type="file" accept=".001,.002,.txt,.csv,text/plain" onChange={onFile} className="text-sm" />

        {rows.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikelnr.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead className="text-right">EK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 12).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{r.artikelnr}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.einheit}</TableCell>
                    <TableCell className="text-right">{r.ek}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 12 ? (
              <p className="text-muted-foreground p-2 text-center text-xs">
                … und {rows.length - 12} weitere Artikel
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={onImport} disabled={busy || rows.length === 0}>
            {busy ? "Importiere …" : `${rows.length} Artikel importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
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
import {
  importProducts,
  type CsvProductRow,
} from "@/app/(app)/produkte/actions";

const COLUMNS = [
  "name",
  "hersteller",
  "kategorie",
  "artikelnr",
  "einheit",
  "ek",
  "vk",
  "gruppe",
] as const;

/** Einfacher CSV-Parser (Komma- oder Semikolon-getrennt, mit/ohne Quotes). */
function parseCsv(text: string): CsvProductRow[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const header = splitLine(lines[0], delim).map((h) => h.trim().toLowerCase());
  const rows: CsvProductRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      if ((COLUMNS as readonly string[]).includes(h)) {
        row[h] = (cells[idx] ?? "").trim();
      }
    });
    rows.push(row as CsvProductRow);
  }
  return rows;
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export function CsvImportDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<CsvProductRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length === 0) {
        toast.error("Keine gültigen Zeilen gefunden.");
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file, "utf-8");
  }

  async function onImport() {
    setBusy(true);
    const res = await importProducts(rows);
    setBusy(false);
    if (res.ok) {
      toast.success(
        `${res.imported} Produkte importiert${
          res.skipped ? `, ${res.skipped} übersprungen` : ""
        }.`,
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
          <DialogTitle>Produkte importieren (CSV)</DialogTitle>
          <DialogDescription>
            Spalten: name, hersteller, kategorie, artikelnr, einheit, ek, vk,
            gruppe.{" "}
            <a
              href="/produkt-import-vorlage.csv"
              download
              className="text-primary underline"
            >
              Vorlage herunterladen
            </a>
          </DialogDescription>
        </DialogHeader>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="text-sm"
        />

        {rows.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Hersteller</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead className="text-right">EK</TableHead>
                  <TableHead className="text-right">VK</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 10).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.hersteller}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.gruppe}
                    </TableCell>
                    <TableCell className="text-right">{r.ek}</TableCell>
                    <TableCell className="text-right">{r.vk}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 10 ? (
              <p className="text-muted-foreground p-2 text-center text-xs">
                … und {rows.length - 10} weitere Zeilen
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button onClick={onImport} disabled={busy || rows.length === 0}>
            {busy ? "Importiere …" : `${rows.length} Produkte importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

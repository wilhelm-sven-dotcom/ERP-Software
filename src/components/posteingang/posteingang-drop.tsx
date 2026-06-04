"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, X, Loader2, Sparkles } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { registerProjectFile } from "@/app/(app)/projekte/actions";
import { registerProductAsset } from "@/app/(app)/produkte/actions";
import { registerDocument, createIncomingInvoice } from "@/app/(app)/posteingang/actions";
import { renderPagesToDataUrls } from "@/lib/pdf/extract-images";
import { extractDocumentText } from "@/lib/pdf/extract-text-smart";
import { cn } from "@/lib/utils";

const PROJECT_BUCKET = "project-files";
const PRODUCT_BUCKET = "product-assets";
const ENTITY_BUCKET = "entity-documents";

type Target = "produkt" | "projekt" | "kunde" | "mitarbeiter" | "buchhaltung";

const TARGET_LABEL: Record<Target, string> = {
  produkt: "Produkt",
  projekt: "Projekt",
  kunde: "Kunde",
  mitarbeiter: "Mitarbeiter",
  buchhaltung: "Buchhaltung (Eingangsrechnung)",
};

interface Opt {
  id: string;
  label: string;
  sub?: string;
}
interface DocMeta {
  supplier?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  amount?: number | string;
  currency?: string;
  docType?: string;
}

interface Row {
  uid: string;
  file: File;
  isPdf: boolean;
  busy: boolean;
  done: boolean;
  error: string | null;
  text: string;
  reason: string;
  confidence: number;
  target: Target;
  productIds: string[];
  projectId: string;
  customerId: string;
  employeeId: string;
  kind: string;
  docMeta: DocMeta | null;
}

let seq = 0;
const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "bin";
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function PosteingangDrop({
  projects,
  products,
  customers,
  employees,
  aiEnabled,
  azureEnabled = false,
  suppliers = [],
}: {
  projects: Opt[];
  products: Opt[];
  customers: Opt[];
  employees: Opt[];
  aiEnabled: boolean;
  azureEnabled?: boolean;
  suppliers?: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [over, setOver] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  // „Alles automatisch": sicher klassifizierte Dokumente direkt ablegen.
  const [autoFile, setAutoFile] = React.useState(false);
  const [hideDone, setHideDone] = React.useState(false);
  const autoFileRef = React.useRef(false);
  autoFileRef.current = autoFile;
  // Aktueller rows-Stand für asynchrone Closures (Auto-Ablage liest hieraus,
  // damit zwischenzeitliche Nutzer-Edits nicht überschrieben werden).
  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

  function patch(uid: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const next: Row[] = arr.map((file) => ({
      uid: `f${++seq}`,
      file,
      isPdf: /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name),
      busy: aiEnabled,
      done: false,
      error: null,
      text: "",
      reason: "",
      confidence: 0,
      target: "projekt",
      productIds: [],
      projectId: "",
      customerId: "",
      employeeId: "",
      kind: "dokument",
      docMeta: null,
    }));
    setRows((rs) => {
      const seen = new Set(rs.map((x) => `${x.file.name}:${x.file.size}`));
      const filtered = next.filter((x) => {
        const k = `${x.file.name}:${x.file.size}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return [...rs, ...filtered];
    });
    if (aiEnabled) for (const row of next) void classify(row);
  }

  async function classify(row: Row) {
    try {
      let images: string[] = [];
      // Robuste Auslese (Azure DI, sonst pdf.js) — auch für Scans.
      const text = await extractDocumentText(row.file);
      if (row.isPdf) {
        try {
          images = await renderPagesToDataUrls(row.file, { maxPages: 2 });
        } catch {
          /* Render fehlgeschlagen → KI nutzt Text/was da ist */
        }
      } else if (/^image\//.test(row.file.type)) {
        try {
          images = [await fileToDataUrl(row.file)];
        } catch {
          /* ignore */
        }
      }
      const res = await fetch("/api/files/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: row.file.name,
          text,
          images,
          projects: projects.map((p) => ({ id: p.id, title: p.label })),
          products: products.slice(0, 140).map((p) => ({ id: p.id, name: p.label, manufacturer: p.sub })),
          customers: customers.slice(0, 120).map((c) => ({ id: c.id, name: c.label, city: c.sub })),
          employees: employees.slice(0, 60).map((e) => ({ id: e.id, name: e.label })),
        }),
      });
      const data = (await res.json()) as {
        enabled?: boolean;
        result?: {
          target: Target;
          productIds: string[];
          projectId: string | null;
          customerId: string | null;
          employeeId: string | null;
          kind: string;
          reason: string;
          confidence?: number;
          document?: DocMeta | null;
        } | null;
      };
      const r = data.result;
      if (!r) {
        patch(row.uid, { busy: false, text });
        return;
      }
      const fields: Partial<Row> = {
        busy: false,
        text,
        target: r.target ?? "projekt",
        productIds: Array.isArray(r.productIds) ? r.productIds : [],
        projectId: r.projectId ?? "",
        customerId: r.customerId ?? "",
        employeeId: r.employeeId ?? "",
        kind: typeof r.kind === "string" ? r.kind : "dokument",
        docMeta: r.document ?? null,
        reason: r.reason ?? "",
        confidence: typeof r.confidence === "number" ? r.confidence : 0,
      };
      patch(row.uid, fields);

      // „Alles automatisch": nur bei eindeutigem Ziel UND hoher Konfidenz (≥ 0,7).
      if (autoFileRef.current && (fields.confidence ?? 0) >= 0.7) {
        // Aktuellen Zeilenstand verwenden (Nutzer-Edits während der Klassifizierung).
        const current = rowsRef.current.find((r) => r.uid === row.uid) ?? row;
        const merged = { ...current, ...fields } as Row;
        if (!entityRequired(merged) || hasTarget(merged)) {
          patch(row.uid, { busy: true });
          const ok = await commitRow(merged);
          patch(row.uid, { busy: false, done: ok });
          if (ok) router.refresh();
        }
      }
    } catch {
      patch(row.uid, { busy: false, error: "KI-Auslese fehlgeschlagen" });
    }
  }

  function optionsFor(target: Target): Opt[] {
    if (target === "produkt") return products;
    if (target === "kunde") return customers;
    if (target === "mitarbeiter") return employees;
    return projects; // projekt + buchhaltung (optionale Projektverknüpfung)
  }
  function selectedEntity(row: Row): string {
    if (row.target === "produkt") return row.productIds[0] ?? "";
    if (row.target === "kunde") return row.customerId;
    if (row.target === "mitarbeiter") return row.employeeId;
    return row.projectId;
  }
  function setEntity(row: Row, id: string) {
    if (row.target === "kunde") patch(row.uid, { customerId: id });
    else if (row.target === "mitarbeiter") patch(row.uid, { employeeId: id });
    else patch(row.uid, { projectId: id });
  }
  function addProduct(row: Row, id: string) {
    if (!id || row.productIds.includes(id)) return;
    patch(row.uid, { productIds: [...row.productIds, id] });
  }
  function removeProduct(row: Row, id: string) {
    patch(row.uid, { productIds: row.productIds.filter((x) => x !== id) });
  }

  function entityRequired(row: Row): boolean {
    // Buchhaltung darf ohne Projekt verbucht werden; alle anderen brauchen ein Ziel.
    return row.target !== "buchhaltung";
  }
  function hasTarget(row: Row): boolean {
    return row.target === "produkt" ? row.productIds.length > 0 : Boolean(selectedEntity(row));
  }

  async function commitRow(row: Row): Promise<boolean> {
    const supabase = createClient();
    const path = (prefix: string) => `${prefix}/${crypto.randomUUID()}.${ext(row.file.name)}`;
    const mime = row.file.type || null;
    try {
      if (row.target === "produkt") {
        if (row.productIds.length === 0) return false;
        const p = path("shared");
        const up = await supabase.storage.from(PRODUCT_BUCKET).upload(p, row.file);
        if (up.error) throw new Error(up.error.message);
        // Dieselbe Datei mehreren Produkten zuordnen (Familien-Datenblatt).
        let okAll = true;
        for (const productId of row.productIds) {
          const r = await registerProductAsset({
            productId,
            kind: row.isPdf ? "datasheet" : "image",
            name: row.file.name,
            storagePath: p,
            mime,
            textContent: row.isPdf ? row.text || null : null,
          });
          if (!r.ok) okAll = false;
        }
        return okAll;
      }
      if (row.target === "projekt") {
        if (!row.projectId) return false;
        const p = path(row.projectId);
        const up = await supabase.storage.from(PROJECT_BUCKET).upload(p, row.file);
        if (up.error) throw new Error(up.error.message);
        const r = await registerProjectFile({
          projectId: row.projectId,
          name: row.file.name,
          storagePath: p,
          mime,
          size: row.file.size,
          kind: row.kind,
          textContent: row.text || null,
          docMeta: (row.docMeta ?? null) as Record<string, unknown> | null,
        });
        return r.ok;
      }
      if (row.target === "kunde" || row.target === "mitarbeiter") {
        const entityId = row.target === "kunde" ? row.customerId : row.employeeId;
        if (!entityId) return false;
        const p = path(`${row.target}/${entityId}`);
        const up = await supabase.storage.from(ENTITY_BUCKET).upload(p, row.file);
        if (up.error) throw new Error(up.error.message);
        const r = await registerDocument({
          entityType: row.target,
          entityId,
          name: row.file.name,
          storagePath: p,
          mime,
          kind: row.kind,
          docMeta: (row.docMeta ?? null) as Record<string, unknown> | null,
          textContent: row.text || null,
        });
        return r.ok;
      }
      // buchhaltung: Datei ablegen + Eingangsrechnung anlegen
      const p = path("eingangsrechnung");
      const up = await supabase.storage.from(ENTITY_BUCKET).upload(p, row.file);
      if (up.error) throw new Error(up.error.message);
      await registerDocument({
        entityType: "allgemein",
        entityId: null,
        name: row.file.name,
        storagePath: p,
        mime,
        kind: "rechnung",
        docMeta: (row.docMeta ?? null) as Record<string, unknown> | null,
        textContent: row.text || null,
      });
      const inv = await createIncomingInvoice({
        supplier: row.docMeta?.supplier ?? null,
        invoice_number: row.docMeta?.invoice_number ?? null,
        invoice_date: row.docMeta?.invoice_date ?? null,
        due_date: row.docMeta?.due_date ?? null,
        amount: row.docMeta?.amount ?? null,
        currency: row.docMeta?.currency ?? null,
        projectId: row.projectId || null,
        documentPath: p,
        documentName: row.file.name,
      });
      return inv.ok;
    } catch (e) {
      patch(row.uid, { error: (e as Error).message || "Fehler beim Ablegen" });
      return false;
    }
  }

  async function commitAll() {
    setCommitting(true);
    let ok = 0;
    let fail = 0;
    for (const row of rows.filter((r) => !r.done)) {
      if (entityRequired(row) && !hasTarget(row)) {
        patch(row.uid, { error: "Bitte Ziel auswählen" });
        fail++;
        continue;
      }
      patch(row.uid, { busy: true, error: null });
      const success = await commitRow(row);
      patch(row.uid, { busy: false, done: success });
      if (success) ok++;
      else fail++;
    }
    setCommitting(false);
    if (ok > 0) toast.success(`${ok} Dokument(e) abgelegt`);
    if (fail > 0) toast.error(`${fail} Dokument(e) nicht abgelegt — bitte prüfen`);
    if (ok > 0) router.refresh();
  }

  const pending = rows.filter((r) => !r.done);

  return (
    <div className="space-y-4">
      <datalist id="posteingang-suppliers">
        {suppliers.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed p-8 text-center transition-colors",
          over ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        )}
      >
        <Upload className="text-muted-foreground mx-auto size-7" />
        <p className="mt-2 text-sm">
          Dokumente hierher ziehen oder{" "}
          <label className="text-primary cursor-pointer underline">
            auswählen
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </label>{" "}
          — die KI sortiert jedes Dokument vor.
        </p>
        {aiEnabled ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Dokument-Auslese:{" "}
            <span className={azureEnabled ? "font-medium text-green-600" : ""}>
              {azureEnabled ? "Azure aktiv" : "Standard (pdf.js)"}
            </span>
          </p>
        ) : null}
        {!aiEnabled ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Hinweis: Ohne KI-Schlüssel musst du Ziel und Typ manuell wählen.
          </p>
        ) : (
          <label className="text-muted-foreground mt-3 inline-flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoFile}
              onChange={(e) => setAutoFile(e.target.checked)}
              className="size-4"
            />
            Sicher erkannte Dokumente automatisch ablegen (ohne Bestätigung)
          </label>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">
            {pending.length} offen · {rows.length - pending.length} abgelegt
          </p>
          <div className="flex items-center gap-3">
            {rows.some((r) => r.done) ? (
              <>
                <label className="text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={hideDone}
                    onChange={(e) => setHideDone(e.target.checked)}
                    className="size-4"
                  />
                  Erledigte ausblenden
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((rs) => rs.filter((r) => !r.done))}
                >
                  Erledigte entfernen
                </Button>
              </>
            ) : null}
            {pending.length > 0 ? (
              <Button onClick={commitAll} disabled={committing}>
                {committing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Alle bestätigen &amp; ablegen
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {(hideDone ? rows.filter((r) => !r.done) : rows).map((row) => (
          <div key={row.uid} className={cn("rounded-lg border p-3", row.done && "opacity-50")}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    const url = URL.createObjectURL(row.file);
                    window.open(url, "_blank");
                    // Blob-URL nach kurzer Zeit freigeben (kein Memory-Leak).
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                  }}
                  className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                  title="Vorschau öffnen"
                >
                  {row.file.name}
                </button>
                {row.busy ? (
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Sparkles className="size-3" /> KI ordnet zu …
                  </p>
                ) : row.reason ? (
                  <p className="text-muted-foreground truncate text-xs">
                    {row.confidence > 0 ? (
                      <span
                        className={cn(
                          "mr-1.5 rounded px-1 py-0.5 font-medium",
                          row.confidence >= 0.7
                            ? "bg-green-500/15 text-green-600"
                            : "bg-amber-500/15 text-amber-600",
                        )}
                      >
                        {Math.round(row.confidence * 100)}%
                      </span>
                    ) : null}
                    {row.reason}
                  </p>
                ) : null}
                {row.error ? <p className="text-destructive text-xs">{row.error}</p> : null}
              </div>
              {row.done ? (
                <span className="text-primary flex items-center gap-1 text-xs font-medium">
                  <Check className="size-4" /> abgelegt
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((r) => r.uid !== row.uid))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Entfernen"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {!row.done ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-muted-foreground text-xs">Ziel</label>
                  <Select value={row.target} onValueChange={(v) => patch(row.uid, { target: v as Target })}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TARGET_LABEL) as Target[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TARGET_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs">
                    {row.target === "buchhaltung"
                      ? "Projekt (optional)"
                      : row.target === "produkt"
                        ? "Produkt(e)"
                        : "Zuordnung"}
                  </label>
                  {row.target === "produkt" ? (
                    <div className="space-y-1.5">
                      <EntityPicker
                        options={products}
                        value=""
                        onChange={(id) => addProduct(row, id)}
                        placeholder="Produkt hinzufügen …"
                      />
                      {row.productIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.productIds.map((id) => {
                            const opt = products.find((o) => o.id === id);
                            return (
                              <span
                                key={id}
                                className="bg-muted inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                              >
                                {opt?.label ?? id}
                                <button
                                  type="button"
                                  onClick={() => removeProduct(row, id)}
                                  className="hover:text-destructive"
                                  aria-label="Entfernen"
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <EntityPicker
                      options={optionsFor(row.target)}
                      value={selectedEntity(row)}
                      onChange={(id) => setEntity(row, id)}
                      placeholder={row.target === "buchhaltung" ? "Ohne Projekt" : "Auswählen …"}
                    />
                  )}
                </div>
                {row.target === "buchhaltung" ? (
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    <div>
                      <label className="text-muted-foreground text-xs">Lieferant</label>
                      <Input
                        className="h-9"
                        list="posteingang-suppliers"
                        value={row.docMeta?.supplier ?? ""}
                        onChange={(e) =>
                          patch(row.uid, { docMeta: { ...row.docMeta, supplier: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs">Rechnungsnr.</label>
                      <Input
                        className="h-9"
                        value={row.docMeta?.invoice_number ?? ""}
                        onChange={(e) =>
                          patch(row.uid, { docMeta: { ...row.docMeta, invoice_number: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs">Rechnungsdatum</label>
                      <Input
                        type="date"
                        className="h-9"
                        value={row.docMeta?.invoice_date ?? ""}
                        onChange={(e) =>
                          patch(row.uid, { docMeta: { ...row.docMeta, invoice_date: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs">Fällig am</label>
                      <Input
                        type="date"
                        className="h-9"
                        value={row.docMeta?.due_date ?? ""}
                        onChange={(e) =>
                          patch(row.uid, { docMeta: { ...row.docMeta, due_date: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs">Betrag (Brutto)</label>
                      <Input
                        inputMode="decimal"
                        className="h-9"
                        value={row.docMeta?.amount != null ? String(row.docMeta.amount) : ""}
                        onChange={(e) =>
                          patch(row.uid, { docMeta: { ...row.docMeta, amount: e.target.value } })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground text-xs">Währung</label>
                      <Input
                        className="h-9"
                        value={row.docMeta?.currency ?? "EUR"}
                        onChange={(e) =>
                          patch(row.uid, { docMeta: { ...row.docMeta, currency: e.target.value } })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Einfaches Such-Dropdown für eine Entität (Projekt/Kunde/Mitarbeiter/Produkt). */
function EntityPicker({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Opt[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const query = q.trim().toLowerCase();
  const filtered = query
    ? options.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(query)).slice(0, 50)
    : options.slice(0, 50);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-input flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 text-left text-sm"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
      </button>
      {open ? (
        <div className="bg-popover absolute z-50 mt-1 w-full rounded-md border p-1 shadow-lg">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Suchen …"
            className="mb-1 h-8"
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-2 py-2 text-xs">Kein Treffer.</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn(
                    "hover:bg-muted flex w-full flex-col rounded px-2 py-1.5 text-left text-sm",
                    o.id === value && "bg-muted",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {o.sub ? <span className="text-muted-foreground truncate text-xs">{o.sub}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

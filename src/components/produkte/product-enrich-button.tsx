"use client";

import * as React from "react";
import { Globe } from "lucide-react";
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
} from "@/components/ui/dialog";
import { updateProductSpecs, attachDocumentFromUrl } from "@/app/(app)/produkte/actions";

interface EnrichResponse {
  enabled?: boolean;
  reason?: string;
  result?: { specs: Record<string, string | number>; sources: string[]; reason: string } | null;
}

type DocKind = "datasheet" | "manual" | "certificate" | "image";
interface FoundDocument {
  kind: DocKind;
  title: string;
  url: string;
}
interface DocsResponse {
  enabled?: boolean;
  result?: { documents: FoundDocument[] } | null;
}
const DOC_LABEL: Record<DocKind, string> = {
  datasheet: "Datenblatt",
  manual: "Anleitung",
  certificate: "Zertifikat",
  image: "Produktbild",
};

/**
 * „Daten aus dem Netz ziehen": sucht das echte Datenblatt im Web, liest die
 * technischen Kenndaten per KI aus und übernimmt die ausgewählten Felder in das
 * Produkt (zur Prüfung durch den Nutzer). Nur im Bearbeiten-Modus (Produkt-ID).
 */
export function ProductEnrichButton({
  productId,
  name,
  manufacturer,
}: {
  productId: string | null;
  name: string;
  manufacturer: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [specs, setSpecs] = React.useState<Record<string, string | number>>({});
  const [sources, setSources] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [docs, setDocs] = React.useState<FoundDocument[]>([]);
  const [docsBusy, setDocsBusy] = React.useState(false);
  const [checkedDocs, setCheckedDocs] = React.useState<Set<string>>(new Set());
  const [attachingDocs, setAttachingDocs] = React.useState(false);

  async function run() {
    setOpen(true);
    setBusy(true);
    setError(null);
    setSpecs({});
    setSources([]);
    setDocs([]);
    setCheckedDocs(new Set());
    // Dokument-Suche parallel anstoßen (blockiert die Specs nicht).
    void fetchDocuments();
    try {
      const res = await fetch("/api/products/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, manufacturer }),
      });
      const data = (await res.json()) as EnrichResponse;
      if (data.enabled === false) {
        setError(data.reason ?? "Web-Suche ist nicht konfiguriert.");
        return;
      }
      if (!data.result || Object.keys(data.result.specs).length === 0) {
        setError(data.result?.reason || data.reason || "Keine verwertbaren Daten gefunden.");
        return;
      }
      setSpecs(data.result.specs);
      setSources(data.result.sources);
      setChecked(new Set(Object.keys(data.result.specs)));
    } catch {
      setError("Anfrage fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function fetchDocuments() {
    setDocsBusy(true);
    try {
      const res = await fetch("/api/products/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          manufacturer,
          wants: ["datasheet", "manual", "certificate", "image"],
        }),
      });
      const data = (await res.json()) as DocsResponse;
      const found = data.result?.documents ?? [];
      setDocs(found);
      setCheckedDocs(new Set(found.map((d) => d.url)));
    } catch {
      /* Dokument-Suche optional → still ignorieren */
    } finally {
      setDocsBusy(false);
    }
  }

  function toggleDoc(url: string) {
    setCheckedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function attachDocs() {
    if (!productId) {
      toast.error("Bitte das Produkt zuerst speichern, dann Dokumente anhängen.");
      return;
    }
    const selected = docs.filter((d) => checkedDocs.has(d.url));
    if (selected.length === 0) {
      toast.error("Bitte mindestens ein Dokument auswählen.");
      return;
    }
    setAttachingDocs(true);
    let ok = 0;
    let failed = 0;
    for (const d of selected) {
      const res = await attachDocumentFromUrl({
        productId,
        url: d.url,
        kind: d.kind,
        name: `${DOC_LABEL[d.kind]}: ${d.title}`.slice(0, 120),
      });
      if (res.ok) ok++;
      else failed++;
    }
    setAttachingDocs(false);
    if (ok > 0) {
      toast.success(`${ok} Dokument(e) angehängt.`);
      setDocs((prev) => prev.filter((d) => !checkedDocs.has(d.url)));
      router.refresh();
    }
    if (failed > 0) toast.error(`${failed} Dokument(e) konnten nicht geladen werden.`);
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function apply() {
    if (!productId) {
      toast.error("Bitte das Produkt zuerst speichern, dann Daten übernehmen.");
      return;
    }
    const selected: Record<string, string | number> = {};
    for (const k of checked) if (k in specs) selected[k] = specs[k];
    if (Object.keys(selected).length === 0) {
      toast.error("Bitte mindestens ein Feld auswählen.");
      return;
    }
    setApplying(true);
    const res = await updateProductSpecs(productId, selected);
    setApplying(false);
    if (res.ok) {
      toast.success("Technische Daten übernommen. Dialog neu öffnen zum Prüfen.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Übernehmen fehlgeschlagen.");
    }
  }

  const entries = Object.entries(specs);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={!name}>
        <Globe className="size-4" /> Daten aus dem Netz ziehen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Technische Daten aus dem Netz</DialogTitle>
            <DialogDescription>
              {name}
              {manufacturer ? ` · ${manufacturer}` : ""} — KI liest das Datenblatt aus.
              Bitte die Werte vor dem Übernehmen prüfen.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {busy ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Suche &amp; lese Datenblatt …</p>
            ) : error ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{error}</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Keine Daten.</p>
            ) : (
              <>
                <ul className="divide-y rounded-md border">
                  {entries.map(([k, v]) => (
                    <li key={k}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked.has(k)}
                          onChange={() => toggle(k)}
                          className="size-4"
                        />
                        <span className="text-muted-foreground w-44 shrink-0">{k}</span>
                        <span className="flex-1 font-medium">{String(v)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {sources.length > 0 ? (
                  <div className="text-muted-foreground mt-3 text-xs">
                    <p className="mb-1 font-medium">Quellen:</p>
                    <ul className="space-y-0.5">
                      {sources.map((s) => (
                        <li key={s} className="truncate">
                          <a href={s} target="_blank" rel="noreferrer" className="hover:underline">
                            {s}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}

            {/* Gefundene Dokumente (Datenblatt/Anleitung/Zertifikat/Bild) */}
            {docsBusy || docs.length > 0 ? (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-sm font-medium">Gefundene Dokumente</p>
                {docsBusy && docs.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Suche Datenblatt, Anleitung, Zertifikat, Bild …</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {docs.map((d) => (
                      <li key={d.url}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checkedDocs.has(d.url)}
                            onChange={() => toggleDoc(d.url)}
                            className="mt-0.5 size-4"
                          />
                          <span className="bg-muted w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium">
                            {DOC_LABEL[d.kind]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{d.title}</span>
                            <a
                              href={d.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground block truncate text-xs hover:underline"
                            >
                              {d.url}
                            </a>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {entries.length > 0 || docs.length > 0 ? (
            <DialogFooter className="gap-2 sm:gap-2">
              {docs.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={attachDocs}
                  disabled={attachingDocs || checkedDocs.size === 0}
                >
                  {attachingDocs ? "Hänge an …" : `${checkedDocs.size} Dokument(e) anhängen`}
                </Button>
              ) : null}
              {entries.length > 0 ? (
                <Button onClick={apply} disabled={applying || checked.size === 0}>
                  {applying ? "Übernehmen …" : `${checked.size} Felder übernehmen`}
                </Button>
              ) : null}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

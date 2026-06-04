"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  registerProjectFile,
  deleteProjectFile,
} from "@/app/(app)/projekte/actions";
import { extractTextFromPdf } from "@/lib/pdf/extract-images";
import { cn } from "@/lib/utils";
import type { ProjectFile } from "@/lib/types";

const BUCKET = "project-files";

/** Dateien per Drag & Drop einem Projekt zuordnen (Datenblätter, Handbücher, …). */
export function ProjectFileDrop({
  projectId,
  files,
}: {
  projectId: string;
  files: ProjectFile[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [over, setOver] = React.useState(false);

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    let ok = 0;
    for (const file of arr) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${projectId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${error.message}`);
        continue;
      }
      // PDF-Volltext für die Inhaltssuche ablegen (best-effort).
      const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      let text: string | null = null;
      if (isPdf) {
        try {
          text = await extractTextFromPdf(file);
        } catch {
          text = null;
        }
      }
      const res = await registerProjectFile({
        projectId,
        name: file.name,
        storagePath: path,
        mime: file.type || null,
        size: file.size,
        textContent: text,
      });
      if (res.ok) ok += 1;
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${ok} Datei(en) hinzugefügt`);
      router.refresh();
    }
  }

  function publicUrl(path: string): string {
    return createClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border border-dashed p-6 text-center text-sm transition-colors",
          over ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        )}
      >
        <Upload className="text-muted-foreground mx-auto mb-2 size-6" />
        <p className="text-muted-foreground">
          Dateien hierher ziehen oder
          <label className="text-primary mx-1 cursor-pointer underline">
            auswählen
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
          {busy ? " – lädt …" : ""}
        </p>
      </div>

      {files.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-col gap-0.5">
                <a
                  href={publicUrl(f.storage_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 hover:underline"
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </a>
                {f.doc_meta ? (
                  <span className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 pl-6 text-xs">
                    {f.doc_meta.supplier ? <span>{f.doc_meta.supplier}</span> : null}
                    {f.doc_meta.invoice_number ? <span>Nr. {f.doc_meta.invoice_number}</span> : null}
                    {f.doc_meta.invoice_date ? <span>{f.doc_meta.invoice_date}</span> : null}
                    {f.doc_meta.amount != null && f.doc_meta.amount !== "" ? (
                      <span className="text-foreground font-medium">
                        {f.doc_meta.amount} {f.doc_meta.currency ?? "€"}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <form action={deleteProjectFile}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="path" value={f.storage_path} />
                <input type="hidden" name="project_id" value={projectId} />
                <Button variant="ghost" size="icon" className="size-7" type="submit" title="Löschen">
                  <Trash2 className="size-3.5" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">Noch keine Dateien.</p>
      )}
    </div>
  );
}

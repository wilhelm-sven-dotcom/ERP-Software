import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { StatusSelect } from "@/components/pipeline/status-select";
import { getProjects } from "@/lib/data/projects";
import { PROJECT_STATUSES } from "@/lib/constants";
import { customerName, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const projects = await getProjects();

  const columns = PROJECT_STATUSES.map((status) => ({
    status,
    items: projects.filter((p) => p.status === status),
  }));
  // Projekte mit unbekanntem Status zusätzlich anzeigen
  const known = new Set<string>(PROJECT_STATUSES);
  const others = projects.filter((p) => !p.status || !known.has(p.status));
  if (others.length > 0) {
    columns.push({ status: "Sonstige" as never, items: others });
  }

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Projekte nach Vertriebsstatus."
      />

      <SupabaseNotice />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.status}
            className="bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border"
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">{col.status}</span>
              <span className="text-muted-foreground text-xs">
                {col.items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {col.items.length === 0 ? (
                <p className="text-muted-foreground px-1 py-4 text-center text-xs">
                  Keine Projekte
                </p>
              ) : (
                col.items.map((p) => (
                  <div
                    key={p.id}
                    className="bg-card rounded-md border p-2.5 shadow-sm"
                  >
                    <Link
                      href={`/projekte/${p.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {p.title ?? "Ohne Titel"}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {p.customer ? customerName(p.customer) : "Kein Kunde"}
                    </p>
                    {p.system_size_kwp ? (
                      <p className="text-muted-foreground text-xs">
                        {formatNumber(p.system_size_kwp)} kWp
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <StatusSelect projectId={p.id} status={p.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

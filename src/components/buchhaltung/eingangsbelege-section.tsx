import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getIncomingDocuments } from "@/lib/data/project-files";
import { customerName, formatDate } from "@/lib/format";

/**
 * Eingezogene Belege (Eingangsrechnungen/Dokumente) mit von der KI ausgelesenen
 * Feldern. Sichtbarkeit über alle Projekte — Grundlage für spätere Verbuchung.
 */
export async function EingangsbelegeSection() {
  const docs = await getIncomingDocuments();
  if (docs.length === 0) {
    return (
      <EmptyState
        title="Noch keine Eingangsbelege"
        description="Ziehe Rechnungen/Lieferscheine in den KI-Assistenten oder ein Projekt — die KI liest Lieferant, Nummer, Betrag und Datum aus und zeigt sie hier."
      />
    );
  }
  return (
    <div className="bg-card rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Beleg</TableHead>
            <TableHead>Lieferant</TableHead>
            <TableHead className="w-28">Nr.</TableHead>
            <TableHead className="w-28">Datum</TableHead>
            <TableHead className="w-28 text-right">Betrag</TableHead>
            <TableHead>Projekt / Kunde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((d) => {
            const m = d.doc_meta ?? {};
            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{m.supplier ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.invoice_number ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.invoice_date ? formatDate(m.invoice_date) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {m.amount != null && m.amount !== "" ? `${m.amount} ${m.currency ?? "€"}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {d.project ? (
                    <Link href={`/projekte/${d.project.id}`} className="hover:underline">
                      {d.project.title ?? "Projekt"}
                      {d.project.customer ? ` · ${customerName(d.project.customer)}` : ""}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { getDocumentsByKind } from "@/lib/data/documents";
import { getIncomingInvoices } from "@/lib/data/incoming-invoices";
import { getAdminStats } from "@/lib/data/stats";
import { formatCurrency } from "@/lib/format";

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const brutto = (t: Record<string, unknown>): number => num((t as { brutto?: number }).brutto);

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: "warn" | "good"; hint?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={tone === "warn" ? "text-destructive text-2xl font-semibold" : "text-2xl font-semibold"}>{value}</p>
        {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Buchhaltungs-Übersicht: Forderungen, Verbindlichkeiten, Liquidität, Pipeline. */
export async function UebersichtSection() {
  const [rechnungen, incoming, stats] = await Promise.all([
    getDocumentsByKind("rechnung"),
    getIncomingInvoices(),
    getAdminStats(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  // Forderungen (Ausgangsrechnungen)
  const open = rechnungen.filter((d) => d.payment_status !== "bezahlt");
  const forderungen = open.reduce((s, d) => s + brutto(d.totals), 0);
  const forderungenUeberfaellig = open
    .filter((d) => d.due_date && d.due_date < today)
    .reduce((s, d) => s + brutto(d.totals), 0);
  const bezahltMonat = rechnungen
    .filter((d) => d.payment_status === "bezahlt" && (d.paid_at ?? "").slice(0, 7) === month)
    .reduce((s, d) => s + brutto(d.totals), 0);

  // Verbindlichkeiten (Eingangsrechnungen)
  const openIn = incoming.filter((i) => i.status !== "bezahlt");
  const verbindlichkeiten = openIn.reduce((s, i) => s + num(i.amount), 0);
  const verbUeberfaellig = openIn
    .filter((i) => i.due_date && i.due_date < today)
    .reduce((s, i) => s + num(i.amount), 0);

  const saldo = forderungen - verbindlichkeiten;

  const hints: { text: string; warn?: boolean }[] = [];
  const overdueOut = open.filter((d) => d.due_date && d.due_date < today).length;
  const overdueIn = openIn.filter((i) => i.due_date && i.due_date < today).length;
  if (overdueOut > 0) hints.push({ text: `${overdueOut} überfällige Ausgangsrechnung(en) — Mahnung prüfen.`, warn: true });
  if (overdueIn > 0) hints.push({ text: `${overdueIn} überfällige Eingangsrechnung(en) — Zahlung prüfen.`, warn: true });
  if (stats.pipelineValue > 0) hints.push({ text: `Pipeline (offen): ${formatCurrency(stats.pipelineValue)} erwarteter Auftragswert.` });
  if (hints.length === 0) hints.push({ text: "Alles im grünen Bereich — keine überfälligen Posten." });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Offene Forderungen" value={formatCurrency(forderungen)} hint={`davon überfällig ${formatCurrency(forderungenUeberfaellig)}`} tone={forderungenUeberfaellig > 0 ? "warn" : undefined} />
        <Kpi label="Offene Verbindlichkeiten" value={formatCurrency(verbindlichkeiten)} hint={`davon überfällig ${formatCurrency(verbUeberfaellig)}`} tone={verbUeberfaellig > 0 ? "warn" : undefined} />
        <Kpi label="Liquiditäts-Saldo" value={formatCurrency(saldo)} hint="Forderungen − Verbindlichkeiten" />
        <Kpi label="Bezahlt (lfd. Monat)" value={formatCurrency(bezahltMonat)} />
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="mb-2 text-sm font-semibold">Hinweise</p>
          <ul className="space-y-1 text-sm">
            {hints.map((h, i) => (
              <li key={i} className={h.warn ? "text-destructive" : "text-muted-foreground"}>• {h.text}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

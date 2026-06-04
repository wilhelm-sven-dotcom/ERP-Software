import { Card, CardContent } from "@/components/ui/card";
import { HelpTip } from "@/components/shared/help-tip";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Calculation, Offer, DocumentRecord } from "@/lib/types";

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}
const brutto = (t: Record<string, unknown>): number => num((t as { brutto?: number }).brutto);

/**
 * Finanz-Kennzahlen eines Projekts auf einen Blick: Auftragswert, Marge,
 * bereits berechnet/bezahlt und offener Betrag. Speist sich aus den ohnehin
 * geladenen Daten (gewählte Kalkulation / angenommenes Angebot / Rechnungen).
 */
export function ProjectSummary({
  variants,
  offers,
  rechnungen,
}: {
  variants: Calculation[];
  offers: Offer[];
  rechnungen: DocumentRecord[];
}) {
  const selectedCalc = variants.find((v) => v.is_selected) ?? variants[0] ?? null;
  const acceptedOffer = offers.find((o) => o.status === "Angenommen") ?? null;
  const valueSource = acceptedOffer ?? selectedCalc;
  if (!valueSource && rechnungen.length === 0) return null;

  const orderValue = acceptedOffer
    ? brutto(acceptedOffer.totals)
    : selectedCalc
      ? brutto(selectedCalc.totals)
      : 0;
  const orderLabel = acceptedOffer ? "aus angenommenem Angebot" : selectedCalc ? "aus Kalkulation" : "–";

  const marge = selectedCalc?.margin ?? null;
  const margeProzent = selectedCalc ? num((selectedCalc.totals as { margeProzent?: number }).margeProzent) : 0;

  const berechnet = rechnungen.reduce((s, d) => s + brutto(d.totals), 0);
  const bezahlt = rechnungen.reduce(
    (s, d) => s + (d.paid_at ? num(d.paid_amount, brutto(d.totals)) : 0),
    0,
  );
  const offen = Math.max(berechnet - bezahlt, 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        label="Auftragswert"
        help="Bruttowert des Vorgangs — aus dem angenommenen Angebot bzw. der gewählten Kalkulation."
        value={formatCurrency(orderValue)}
        sub={orderLabel}
      />
      <Kpi
        label="Marge (DB)"
        helpId="calc-marge"
        value={marge != null ? formatCurrency(marge) : "–"}
        sub={marge != null ? `${formatNumber(margeProzent, 1)} %` : "keine Kalkulation"}
      />
      <Kpi
        label="Berechnet"
        help="Summe aller gestellten Rechnungen (brutto) in diesem Projekt."
        value={formatCurrency(berechnet)}
        sub={`${rechnungen.length} Rechnung(en)`}
      />
      <Kpi
        label="Offener Betrag"
        helpId="open-items"
        value={formatCurrency(offen)}
        sub={offen > 0 ? `${formatCurrency(bezahlt)} bezahlt` : "alles bezahlt"}
        accent={offen > 0}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  help,
  helpId,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  help?: string;
  helpId?: string;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          {label} <HelpTip id={helpId} text={help} />
        </p>
        <p className={"text-xl font-bold " + (accent ? "text-destructive" : "")}>{value}</p>
        <p className="text-muted-foreground text-xs">{sub}</p>
      </CardContent>
    </Card>
  );
}

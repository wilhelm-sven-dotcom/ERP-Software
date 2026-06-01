"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  computeWirtschaft,
  type WirtschaftParams,
} from "@/lib/calc/wirtschaft";
import { formatCurrency, formatNumber } from "@/lib/format";

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function WirtschaftRechner({
  kwp,
  speicherKwh,
  investBrutto,
  defaults,
}: {
  kwp: number;
  speicherKwh: number;
  investBrutto: number;
  defaults: WirtschaftParams;
}) {
  const [p, setP] = React.useState<WirtschaftParams>(defaults);

  const set = (k: keyof WirtschaftParams) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setP((prev) => ({ ...prev, [k]: Number(e.target.value) }));

  const r = React.useMemo(
    () => computeWirtschaft({ kwp, speicherKwh, investBrutto }, p),
    [kwp, speicherKwh, investBrutto, p],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Amortisation"
          value={r.amortisationJahr ? `${r.amortisationJahr} Jahre` : "> Laufzeit"}
        />
        <Kpi label="Ø Rendite p.a." value={`${formatNumber(r.renditeProzent, 1)} %`} />
        <Kpi
          label="Ertrag 1. Jahr"
          value={`${formatNumber(r.ertragWirtschaftlichJahr1)} €`}
        />
        <Kpi
          label={`Erlöse ${p.laufzeit} J.`}
          value={formatCurrency(r.summeErloese)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Annahmen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Param label="Spez. Ertrag (kWh/kWp)" value={p.ertragKwhProKwp} onChange={set("ertragKwhProKwp")} step="10" />
            <Param label="Eigenverbrauch (%)" value={p.eigenverbrauchsAnteil} onChange={set("eigenverbrauchsAnteil")} step="1" />
            <Param label="Strompreis (€/kWh)" value={p.strompreis} onChange={set("strompreis")} step="0.01" />
            <Param label="Einspeisevergütung (€/kWh)" value={p.einspeiseverguetung} onChange={set("einspeiseverguetung")} step="0.001" />
            <Param label="Strompreissteigerung (%/J)" value={p.strompreissteigerung} onChange={set("strompreissteigerung")} step="0.1" />
            <Param label="Degradation (%/J)" value={p.degradation} onChange={set("degradation")} step="0.1" />
            <Param label="Laufzeit (Jahre)" value={p.laufzeit} onChange={set("laufzeit")} step="1" />
            <p className="text-muted-foreground text-xs">
              Investition (brutto, aus Kalkulation):{" "}
              <strong className="text-foreground">
                {formatCurrency(investBrutto)}
              </strong>
              {speicherKwh > 0
                ? ` · Speicher erhöht Eigenverbrauch auf ${formatNumber(r.eigenverbrauchProzent, 0)} %`
                : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cashflow-Prognose</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jahr</TableHead>
                  <TableHead className="text-right">Ertrag kWh</TableHead>
                  <TableHead className="text-right">Ersparnis</TableHead>
                  <TableHead className="text-right">Einspeisung</TableHead>
                  <TableHead className="text-right">Cashflow</TableHead>
                  <TableHead className="text-right">Kumuliert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.rows.map((row) => (
                  <TableRow
                    key={row.jahr}
                    className={
                      row.jahr === r.amortisationJahr ? "bg-accent/50" : undefined
                    }
                  >
                    <TableCell>{row.jahr}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.ertrag, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.stromkostenErsparnis)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.einspeiseErloese)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.cashflow)}
                    </TableCell>
                    <TableCell
                      className={
                        row.kumuliert >= 0
                          ? "text-right text-[var(--success)]"
                          : "text-right text-muted-foreground"
                      }
                    >
                      {formatCurrency(row.kumuliert)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Param({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={onChange} className="h-8" />
    </div>
  );
}

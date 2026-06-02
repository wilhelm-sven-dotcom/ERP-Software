import type { CompanySettings } from "@/lib/data/settings";
import type { Customer } from "@/lib/types";

/** Anrede-Zeile aus den Kundendaten (oder neutral). */
export function salutationLine(
  customer: Pick<Customer, "salutation" | "last_name" | "academic_title"> | null,
): string {
  const s = customer?.salutation?.trim();
  const name = [customer?.academic_title, customer?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (s === "Herr" && name) return `Sehr geehrter Herr ${name},`;
  if (s === "Frau" && name) return `Sehr geehrte Frau ${name},`;
  return "Sehr geehrte Damen und Herren,";
}

/** Briefkopf: Logo + Firmenname/Adresse links, Dokumenttitel rechts. */
export function DocumentHeader({
  company,
  rightTitle,
  rightLines = [],
}: {
  company: CompanySettings;
  rightTitle: string;
  rightLines?: string[];
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {company.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logo_url}
            alt={company.name || "Logo"}
            className="h-14 max-w-44 object-contain"
          />
        ) : null}
        <div>
          <h2 className="text-primary text-xl font-bold">
            {company.name || "ip³ Energietechnik"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {[
              company.street,
              [company.zip, company.city].filter(Boolean).join(" "),
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </div>
      <div className="text-right text-sm">
        <p className="font-semibold">{rightTitle}</p>
        {rightLines.map((l, i) => (
          <p key={i} className="text-muted-foreground">
            {l}
          </p>
        ))}
      </div>
    </header>
  );
}

/** Empfängerblock (Anschriftenfeld). */
export function RecipientBlock({
  customer,
}: {
  customer: Customer | null;
}) {
  if (!customer) {
    return (
      <div className="mt-8">
        <p className="text-muted-foreground text-xs">Empfänger</p>
        <p className="font-medium">—</p>
      </div>
    );
  }
  const personName = [
    customer.salutation,
    customer.academic_title,
    customer.first_name,
    customer.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return (
    <div className="mt-8 text-sm leading-relaxed">
      {customer.company ? <p className="font-medium">{customer.company}</p> : null}
      {personName ? <p className={customer.company ? "" : "font-medium"}>{personName}</p> : null}
      {customer.street ? <p>{customer.street}</p> : null}
      {customer.zip || customer.city ? (
        <p>{[customer.zip, customer.city].filter(Boolean).join(" ")}</p>
      ) : null}
    </div>
  );
}

/** Fußzeile mit Firmen-/Registerdaten. */
export function DocumentFooter({ company }: { company: CompanySettings }) {
  const line1 = [
    company.name,
    company.street,
    [company.zip, company.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
  const line2 = [
    company.phone ? `Tel ${company.phone}` : "",
    company.fax ? `Fax ${company.fax}` : "",
    company.email,
    company.website,
  ]
    .filter(Boolean)
    .join(" · ");
  const line3 = [company.ceo ? `Geschäftsführung: ${company.ceo}` : "", company.register]
    .filter(Boolean)
    .join(" · ");
  const line4 = [
    company.tax_number ? `Steuernr. ${company.tax_number}` : "",
    company.vat_id ? `USt-IdNr. ${company.vat_id}` : "",
    company.iban ? `IBAN ${company.iban}` : "",
    company.bic ? `BIC ${company.bic}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <footer className="text-muted-foreground mt-10 border-t pt-4 text-center text-[11px] leading-relaxed">
      {line1 ? <p>{line1}</p> : null}
      {line2 ? <p>{line2}</p> : null}
      {line3 ? <p>{line3}</p> : null}
      {line4 ? <p>{line4}</p> : null}
    </footer>
  );
}

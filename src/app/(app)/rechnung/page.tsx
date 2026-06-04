import { redirect } from "next/navigation";

/** Rechnungen sind in die „Buchhaltung" umgezogen. */
export default function RechnungPage() {
  redirect("/buchhaltung");
}

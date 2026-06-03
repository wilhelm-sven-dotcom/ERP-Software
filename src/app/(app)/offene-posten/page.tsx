import { redirect } from "next/navigation";

/** Offene Posten sind in die „Buchhaltung" umgezogen. */
export default function OffenePostenPage() {
  redirect("/buchhaltung");
}

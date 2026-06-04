import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { HelpGlossary } from "@/components/help/help-glossary";

export const metadata: Metadata = { title: "Hilfe" };

export default function HilfePage() {
  return (
    <div>
      <PageHeader
        title="Hilfe & Glossar"
        description="Erklärungen zu allen Funktionen und Begriffen. Tipp: Das kleine (i)-Symbol im Programm öffnet die passende Kurzhilfe direkt an Ort und Stelle."
      />
      <HelpGlossary />
    </div>
  );
}

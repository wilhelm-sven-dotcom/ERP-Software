"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Löst den Druckdialog des Browsers aus (PDF-Export über „Als PDF speichern"). */
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" /> Drucken / PDF
    </Button>
  );
}

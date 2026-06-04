"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tab-Container für die Buchhaltung. Die Inhalte werden als server-gerenderte
 * Kinder übergeben (Rechnungen / Offene Posten / Eingangsbelege).
 */
export function BuchhaltungTabs({
  uebersicht,
  rechnungen,
  offenePosten,
  eingangsbelege,
}: {
  uebersicht: React.ReactNode;
  rechnungen: React.ReactNode;
  offenePosten: React.ReactNode;
  eingangsbelege: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="uebersicht">
      <TabsList>
        <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
        <TabsTrigger value="rechnungen">Rechnungen</TabsTrigger>
        <TabsTrigger value="offene-posten">Offene Posten</TabsTrigger>
        <TabsTrigger value="eingangsbelege">Eingangsbelege</TabsTrigger>
      </TabsList>
      <TabsContent value="uebersicht" className="mt-4">{uebersicht}</TabsContent>
      <TabsContent value="rechnungen" className="mt-4">
        {rechnungen}
      </TabsContent>
      <TabsContent value="offene-posten" className="mt-4">
        {offenePosten}
      </TabsContent>
      <TabsContent value="eingangsbelege" className="mt-4">
        {eingangsbelege}
      </TabsContent>
    </Tabs>
  );
}

"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tab-Gliederung der Projekt-Detailseite: der ganze Vorgang (Kalkulation →
 * Wirtschaftlichkeit → Angebot → Belege) lebt im Projekt. Inhalte werden als
 * server-gerenderte Kinder übergeben.
 */
export function ProjectTabs({
  uebersicht,
  kalkulation,
  angebot,
  belege,
  ablauf,
  dateien,
}: {
  uebersicht: React.ReactNode;
  kalkulation: React.ReactNode;
  angebot: React.ReactNode;
  belege: React.ReactNode;
  ablauf: React.ReactNode;
  dateien: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="uebersicht">
      <TabsList className="flex-wrap">
        <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
        <TabsTrigger value="kalkulation">Kalkulation & Wirtschaftlichkeit</TabsTrigger>
        <TabsTrigger value="angebot">Angebot</TabsTrigger>
        <TabsTrigger value="belege">Auftrag & Belege</TabsTrigger>
        <TabsTrigger value="ablauf">Ablauf</TabsTrigger>
        <TabsTrigger value="dateien">Dateien</TabsTrigger>
      </TabsList>
      <TabsContent value="uebersicht" className="mt-4">{uebersicht}</TabsContent>
      <TabsContent value="kalkulation" className="mt-4">{kalkulation}</TabsContent>
      <TabsContent value="angebot" className="mt-4">{angebot}</TabsContent>
      <TabsContent value="belege" className="mt-4">{belege}</TabsContent>
      <TabsContent value="ablauf" className="mt-4">{ablauf}</TabsContent>
      <TabsContent value="dateien" className="mt-4">{dateien}</TabsContent>
    </Tabs>
  );
}

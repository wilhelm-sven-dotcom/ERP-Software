"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TAB_VALUES = ["uebersicht", "kalkulation", "angebot", "belege", "ablauf", "dateien"];

/**
 * Tab-Gliederung der Projekt-Detailseite: der ganze Vorgang (Kalkulation →
 * Wirtschaftlichkeit → Angebot → Belege) lebt im Projekt. Inhalte werden als
 * server-gerenderte Kinder übergeben.
 *
 * Der aktive Tab wird über den URL-Hash (`#belege`) gesteuert, damit die
 * interaktive Status-Kette oben direkt zum jeweiligen Schritt springen kann.
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
  const [tab, setTab] = React.useState("uebersicht");

  React.useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (TAB_VALUES.includes(h)) setTab(h);
    };
    // Initial verzögert (nicht synchron im Effekt) + auf Hash-Wechsel reagieren.
    const id = window.setTimeout(apply, 0);
    window.addEventListener("hashchange", apply);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("hashchange", apply);
    };
  }, []);

  function onChange(v: string) {
    setTab(v);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${v}`);
  }

  return (
    <Tabs value={tab} onValueChange={onChange}>
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

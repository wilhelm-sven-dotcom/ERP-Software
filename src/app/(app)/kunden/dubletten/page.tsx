import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDuplicateCustomerGroups } from "@/lib/data/customers";
import { customerName } from "@/lib/format";

export const metadata: Metadata = { title: "Dubletten" };

export default async function DublettenPage() {
  const groups = await getDuplicateCustomerGroups();

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/kunden">
            <ArrowLeft className="size-4" /> Zur Kundenliste
          </Link>
        </Button>
      </div>
      <PageHeader
        title="Mögliche Dubletten"
        description="Kunden mit gleichem Namen und gleicher PLZ/Ort — bitte prüfen und ggf. zusammenführen."
      />
      <SupabaseNotice />

      {groups.length === 0 ? (
        <EmptyState title="Keine Dubletten gefunden" description="Der Kundenstamm sieht sauber aus. 🎉" />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.key}>
              <CardHeader>
                <CardTitle className="text-base">
                  {g.label}{" "}
                  <span className="text-muted-foreground font-normal">({g.customers.length} Einträge)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {g.customers.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/kunden/${c.id}`} className="font-medium hover:underline">
                          {customerName(c)}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {c.customer_nr ? `Nr. ${c.customer_nr} · ` : ""}
                          {[c.street, [c.zip, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
                          {c.email ? ` · ${c.email}` : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/kunden/${c.id}`}>Öffnen</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

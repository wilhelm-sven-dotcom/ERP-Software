import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SupabaseNotice } from "@/components/shared/supabase-notice";
import { Button } from "@/components/ui/button";
import { TemplateEditor } from "@/components/vorlagen/template-editor";
import { getCalcTemplate } from "@/lib/data/templates";
import { getProducts, getProductGroups } from "@/lib/data/products";

export const metadata: Metadata = { title: "Vorlage bearbeiten" };

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, products, productGroups] = await Promise.all([
    getCalcTemplate(id),
    getProducts(),
    getProductGroups(),
  ]);
  if (!template) notFound();

  return (
    <div>
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/vorlagen">
            <ArrowLeft className="size-4" /> Zu den Vorlagen
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Vorlage: ${template.name}`}
        description="Positionen aus dem Katalog wählen, Mengen-Vorschlag und Defaults setzen."
      />

      <SupabaseNotice />

      <TemplateEditor
        template={template}
        products={products}
        productGroups={productGroups}
      />
    </div>
  );
}

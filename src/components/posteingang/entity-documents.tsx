import { FileText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentsWithUrls, type DocumentEntityType } from "@/lib/data/entity-documents";
import { deleteEntityDocument } from "@/app/(app)/posteingang/actions";
import { formatDateTime } from "@/lib/format";

/**
 * Dokumente-Karte für eine Entität (Kunde/Mitarbeiter): listet die über den
 * Posteingang abgelegten Dateien mit Download-Link (zeitlich begrenzt).
 */
export async function EntityDocuments({
  entityType,
  entityId,
}: {
  entityType: DocumentEntityType;
  entityId: string;
}) {
  const docs = await getDocumentsWithUrls(entityType, entityId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Dokumente{docs.length > 0 ? ` (${docs.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {docs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Noch keine Dokumente. Im Posteingang hochladen — die KI ordnet sie hierher zu.
          </p>
        ) : (
          <ul className="divide-y">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:underline">
                      {d.name}
                    </a>
                  ) : (
                    <span className="truncate text-sm font-medium">{d.name}</span>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {d.kind} · {formatDateTime(d.created_at)}
                  </p>
                </div>
                <form action={deleteEntityDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="path" value={d.storage_path} />
                  <input type="hidden" name="entity_type" value={entityType} />
                  <input type="hidden" name="entity_id" value={entityId} />
                  <Button type="submit" variant="ghost" size="icon" className="size-7" title="Entfernen">
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

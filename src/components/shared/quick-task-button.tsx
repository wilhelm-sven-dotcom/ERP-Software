"use client";

import * as React from "react";
import { SquarePen } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuickTask } from "@/components/shared/quick-task";
import { getQuickTaskData } from "@/app/(app)/workflow/quick-actions";

type Data = Awaited<ReturnType<typeof getQuickTaskData>>;

/** Header-Button neben der Suche: Schnellaufgabe/Rückfrage an Kollegen. */
export function QuickTaskButton() {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<Data | null>(null);

  React.useEffect(() => {
    if (open && !data) void getQuickTaskData().then(setData);
  }, [open, data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Aufgabe / Rückfrage an Kollegen"
          className="text-muted-foreground hover:bg-muted flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
        >
          <SquarePen className="size-4" />
          <span className="hidden sm:inline">Aufgabe</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schnellaufgabe / Rückfrage</DialogTitle>
          <DialogDescription>An eine/n oder mehrere Kollegen — optional mit Projekt.</DialogDescription>
        </DialogHeader>
        {data ? (
          <QuickTask employees={data.employees} projects={data.projects} onDone={() => setOpen(false)} />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">Lädt …</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

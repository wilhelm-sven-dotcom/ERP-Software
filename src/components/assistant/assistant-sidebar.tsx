"use client";

import * as React from "react";
import Link from "next/link";
import {
  Menu,
  PanelLeft,
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Settings,
  HelpCircle,
  Database,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/app-shell/nav-links";
import { cn } from "@/lib/utils";

interface ConversationRow {
  id: string;
  title: string | null;
  updated_at: string;
}

/**
 * Gemini-artige, einklappbare Sidebar der KI-Startseite: oben Menü (alle Module
 * im Sheet) + „Neuer Chat", Mitte der Gesprächsverlauf (mit Suche), unten
 * Einstellungen/Hilfe. Eingeklappt nur Icons.
 */
export function AssistantSidebar({
  conversations,
  conversationId,
  histQuery,
  onHistQuery,
  histResults,
  onNew,
  onOpen,
  onDelete,
  canIndex = false,
  indexing = false,
  onIndex,
}: {
  conversations: ConversationRow[];
  conversationId: string | null;
  histQuery: string;
  onHistQuery: (v: string) => void;
  histResults: ConversationRow[] | null;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  canIndex?: boolean;
  indexing?: boolean;
  onIndex?: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const visible = histResults ?? conversations;

  return (
    <aside
      className={cn(
        "bg-card/40 hidden shrink-0 flex-col border-r backdrop-blur transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-72",
      )}
    >
      {/* Kopf: Module-Menü + Einklappen */}
      <div className={cn("flex h-16 items-center gap-1 px-3", collapsed && "flex-col justify-center gap-2 py-2")}>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" title="Menü / alle Module" aria-label="Menü öffnen">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="h-16 justify-center border-b px-4">
              <SheetTitle className="text-left">Module</SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          title={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          onClick={() => setCollapsed((v) => !v)}
        >
          <PanelLeft className="size-5" />
        </Button>
      </div>

      {/* Neuer Chat */}
      <div className="px-3">
        <Button
          variant="outline"
          size={collapsed ? "icon" : "sm"}
          className={cn("rounded-full", collapsed ? "size-10" : "w-full justify-start gap-2")}
          onClick={onNew}
          title="Neuer Chat"
        >
          <Plus className="size-4" />
          {collapsed ? null : "Neuer Chat"}
        </Button>
      </div>

      {/* Verlauf (nur im ausgeklappten Zustand) */}
      {collapsed ? (
        <div className="flex-1" />
      ) : (
        <>
          <div className="relative mt-3 px-3">
            <Search className="text-muted-foreground absolute top-2.5 left-5 size-3.5" />
            <Input
              value={histQuery}
              onChange={(e) => onHistQuery(e.target.value)}
              placeholder="Verlauf durchsuchen …"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3">
            {visible.length === 0 ? (
              <p className="text-muted-foreground px-2 py-1 text-xs">
                {histQuery.trim() ? "Keine Treffer." : "Noch keine Gespräche."}
              </p>
            ) : (
              visible.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm",
                    c.id === conversationId ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate">{c.title ?? "Gespräch"}</span>
                  </button>
                  <button
                    type="button"
                    title="Löschen"
                    onClick={() => onDelete(c.id)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Fuß: Einstellungen / Hilfe / Indexieren */}
      <div className={cn("space-y-0.5 border-t p-3", collapsed && "flex flex-col items-center")}>
        {canIndex ? (
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn("text-muted-foreground", collapsed ? "" : "w-full justify-start gap-2")}
            disabled={indexing}
            onClick={onIndex}
            title="Dokumente für die KI-Suche indexieren"
          >
            {indexing ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
            {collapsed ? null : "Dokumente indexieren"}
          </Button>
        ) : null}
        <Button
          asChild
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn("text-muted-foreground", collapsed ? "" : "w-full justify-start gap-2")}
        >
          <Link href="/einstellungen" title="Einstellungen">
            <Settings className="size-4" />
            {collapsed ? null : "Einstellungen"}
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn("text-muted-foreground", collapsed ? "" : "w-full justify-start gap-2")}
        >
          <Link href="/hilfe" title="Hilfe">
            <HelpCircle className="size-4" />
            {collapsed ? null : "Hilfe"}
          </Link>
        </Button>
      </div>
    </aside>
  );
}

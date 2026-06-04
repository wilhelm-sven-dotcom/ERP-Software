"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Settings, LogOut, Menu, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/app-shell/nav-links";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/assistent/actions";

type Mode = "crm" | "general";
const MODE_LABEL: Record<Mode, string> = { crm: "CRM-Daten", general: "Allgemein" };

/**
 * Top-Bar der KI-Startseite: links Wortmarke + Modell-Dropdown (CRM/Allgemein),
 * rechts Theme-Umschalter + Avatar-Menü (Einstellungen/Abmelden).
 */
export function AssistantTopbar({
  firstName,
  mode,
  onModeChange,
  logoUrl,
  onNew,
}: {
  firstName?: string;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  logoUrl?: string | null;
  onNew?: () => void;
}) {
  const initial = (firstName ?? "").trim().charAt(0).toUpperCase() || "?";
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4">
      <div className="flex items-center gap-2">
        {/* Mobiles Menü (Module + Neuer Chat) — Sidebar ist unter md ausgeblendet. */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menü öffnen">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="h-16 justify-center border-b px-4">
              <SheetTitle className="text-left">Module</SheetTitle>
            </SheetHeader>
            {onNew ? (
              <div className="px-3 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 rounded-full"
                  onClick={() => {
                    onNew();
                    setMenuOpen(false);
                  }}
                >
                  <Plus className="size-4" /> Neuer Chat
                </Button>
              </div>
            ) : null}
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <BrandLogo logoUrl={logoUrl} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
              {MODE_LABEL[mode]}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onModeChange("crm")}>
              {MODE_LABEL.crm}
              <span className="text-muted-foreground ml-2 text-xs">deine Firmendaten</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onModeChange("general")}>
              {MODE_LABEL.general}
              <span className="text-muted-foreground ml-2 text-xs">freies Wissen</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={firstName || "Konto"}
              className="from-primary to-[#5ac8fa] text-primary-foreground grid size-9 place-items-center rounded-full bg-gradient-to-br text-sm font-semibold"
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href="/einstellungen">
                <Settings className="size-4" /> Einstellungen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut className="size-4" /> Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

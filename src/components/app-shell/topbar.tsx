"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Breadcrumb } from "@/components/app-shell/breadcrumb";
import { GlobalSearch } from "@/components/shared/global-search";

/** Topbar: mobiles Menü, Zurück, Breadcrumb, Theme-Toggle, „Neues Projekt". */
export function Topbar() {
  const router = useRouter();

  return (
    <header
      data-app-shell-chrome
      className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 items-center gap-1 border-b px-3 backdrop-blur"
    >
      <MobileNav />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.back()}
        aria-label="Zurück"
        title="Zurück"
      >
        <ArrowLeft />
      </Button>
      <Breadcrumb />
      <div className="flex-1" />
      <GlobalSearch />
      <ThemeToggle />
      <Button size="sm" className="gap-1.5" title="Neues Projekt anlegen" asChild>
        <Link href="/projekte?neu=1">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Neues Projekt</span>
        </Link>
      </Button>
    </header>
  );
}


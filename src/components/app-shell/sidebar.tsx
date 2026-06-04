import { BrandLogo } from "@/components/brand-logo";
import { NavLinks } from "@/components/app-shell/nav-links";
import { SidebarFooter } from "@/components/app-shell/sidebar-footer";

/** Feste Desktop-Sidebar (ab `lg` sichtbar). Mobil → siehe MobileNav (Sheet). */
export function Sidebar({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <aside
      data-app-shell-chrome
      className="bg-sidebar/80 text-sidebar-foreground border-sidebar-border supports-[backdrop-filter]:bg-sidebar/65 sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r backdrop-blur-xl lg:flex"
    >
      <div className="border-sidebar-border flex h-16 items-center border-b px-5">
        <BrandLogo logoUrl={logoUrl} />
      </div>
      <NavLinks />
      <SidebarFooter />
    </aside>
  );
}

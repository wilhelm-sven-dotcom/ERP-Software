import { BrandLogo } from "@/components/brand-logo";
import { NavLinks } from "@/components/app-shell/nav-links";
import { SidebarFooter } from "@/components/app-shell/sidebar-footer";

/** Feste Desktop-Sidebar (ab `lg` sichtbar). Mobil → siehe MobileNav (Sheet). */
export function Sidebar() {
  return (
    <aside
      data-app-shell-chrome
      className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex"
    >
      <div className="border-sidebar-border flex h-14 items-center border-b px-5">
        <BrandLogo />
      </div>
      <NavLinks />
      <SidebarFooter />
    </aside>
  );
}

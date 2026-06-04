import { BrandLogo } from "@/components/brand-logo";
import { NavLinks } from "@/components/app-shell/nav-links";
import { SidebarFooter } from "@/components/app-shell/sidebar-footer";
import { SidebarShell } from "@/components/app-shell/sidebar-shell";

/** Feste Desktop-Sidebar (ab `lg` sichtbar), ein-/ausklappbar. Mobil → MobileNav. */
export function Sidebar({
  logoUrl,
  defaultCollapsed = true,
}: {
  logoUrl?: string | null;
  defaultCollapsed?: boolean;
}) {
  return (
    <SidebarShell
      defaultCollapsed={defaultCollapsed}
      brand={<BrandLogo logoUrl={logoUrl} />}
      nav={<NavLinks />}
      footer={<SidebarFooter />}
    />
  );
}

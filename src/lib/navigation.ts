import {
  LayoutGrid,
  Sparkles,
  FolderKanban,
  GitBranch,
  Users,
  Wallet,
  Wrench,
  LifeBuoy,
  Clock,
  CalendarDays,
  Files,
  Package,
  Truck,
  UserCog,
  Settings,
  Database,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Stabiler Schlüssel (entspricht dem Legacy `data-page`). */
  key: string;
  /** Anzeige-Label (Deutsch, wie im Original). */
  label: string;
  /** Route unter der App-Shell. */
  href: string;
  icon: LucideIcon;
}

/**
 * Einzige Quelle der Navigation (Goldene Regel #2 — keine Duplikate).
 * Reihenfolge & Labels 1:1 aus der Legacy-Sidebar
 * (legacy/ip3_PV_Tool_6_19.html, #mainNav).
 */
export const navItems: NavItem[] = [
  { key: "assistent", label: "KI-Assistent", href: "/assistent", icon: Sparkles },
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { key: "projekte", label: "Projekte", href: "/projekte", icon: FolderKanban },
  { key: "pipeline", label: "Vertrieb", href: "/pipeline", icon: GitBranch },
  { key: "kunden", label: "Kunden", href: "/kunden", icon: Users },
  { key: "buchhaltung", label: "Buchhaltung", href: "/buchhaltung", icon: Wallet },
  { key: "wartung", label: "Wartung", href: "/wartung", icon: Wrench },
  { key: "service", label: "Service", href: "/service", icon: LifeBuoy },
  {
    key: "zeiterfassung",
    label: "Zeiterfassung",
    href: "/zeiterfassung",
    icon: Clock,
  },
  { key: "plantafel", label: "Plantafel", href: "/plantafel", icon: CalendarDays },
  { key: "vorlagen", label: "Vorlagen", href: "/vorlagen", icon: Files },
  { key: "produkte", label: "Produkte", href: "/produkte", icon: Package },
  {
    key: "grosshaendler",
    label: "Großhändler",
    href: "/grosshaendler",
    icon: Truck,
  },
  {
    key: "mitarbeiter",
    label: "Mitarbeiter",
    href: "/mitarbeiter",
    icon: UserCog,
  },
  {
    key: "einstellungen",
    label: "Einstellungen",
    href: "/einstellungen",
    icon: Settings,
  },
  { key: "backup", label: "Backup", href: "/backup", icon: Database },
  { key: "hilfe", label: "Hilfe", href: "/hilfe", icon: HelpCircle },
];

/** Findet den am besten passenden Nav-Eintrag zu einem Pfad (für Breadcrumb/Active-State). */
export function findNavItemByPath(pathname: string): NavItem | undefined {
  return navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
}

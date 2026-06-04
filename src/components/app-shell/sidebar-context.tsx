"use client";

import * as React from "react";

/** Ob die Desktop-Sidebar eingeklappt ist (nur Icons). Default: false (= mobil/ohne Shell). */
export const SidebarCollapsedContext = React.createContext(false);

export function useSidebarCollapsed(): boolean {
  return React.useContext(SidebarCollapsedContext);
}

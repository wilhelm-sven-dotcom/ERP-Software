"use client";

import { useEffect } from "react";

/** Registriert den Service Worker (PWA, Offline-Fähigkeit). */
export function PwaRegister() {
  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      const onLoad = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          /* Registrierung fehlgeschlagen — App funktioniert weiterhin online. */
        });
      };
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);
  return null;
}

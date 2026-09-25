"use client";
// Übernommen aus Workgrid components/pwa/ServiceWorkerRegister.tsx, unverändert.

import { useEffect } from "react";

/**
 * Registriert den Service Worker (nur in Produktion). Macht die App in Chrome
 * installierbar (Manifest + SW mit fetch-Handler). Der SW selbst cacht keine
 * API-Antworten (siehe public/sw.js).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Registrierung fehlgeschlagen — App funktioniert weiterhin ohne SW. */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}

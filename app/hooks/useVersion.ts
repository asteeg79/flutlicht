"use client";
// Übernommen aus WM-Tipp app/src/lib/useVersion.ts, angepasst: Next statt Vite (Version aus
// NEXT_PUBLIC_APP_*), ohne vite-plugin-pwa und React Query; Poll auf /version.json.
import { useEffect, useState } from "react";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";

const POLL_MS = 5 * 60_000;

/** true, sobald auf dem Server ein neuerer Build (Code oder Daten) liegt. */
export function useUpdateAvailable(): boolean {
  const [latest, setLatest] = useState<{
    version: number;
    commit: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok && active) setLatest(await res.json());
      } catch {
        /* offline o. Ä. → ignorieren */
      }
    };
    void check();
    const id = setInterval(() => void check(), POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  return (
    latest !== null &&
    APP_COMMIT !== "dev" &&
    latest.commit !== APP_COMMIT &&
    latest.version >= APP_VERSION
  );
}

import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { ManagerDoc } from "@fm/core";
import { auth } from "@/lib/auth";
import { leagueTable } from "@/lib/standings";
import { listAllManagers, loadManager } from "@/lib/storage";

/**
 * Manager der aktuellen Session für Server-Komponenten; ohne Konto zurück zur Anmeldung.
 * Je Request nur einmal geladen (Layout und Seite fragen beide).
 */
export const currentManager = cache(async (): Promise<ManagerDoc> => {
  const session = await auth();
  const doc = session?.user?.id ? await loadManager(session.user.id) : null;
  if (!doc) redirect("/login");
  return doc;
});

/** Alle Manager-Dokumente, je Request nur einmal gelesen (Layout, Tabelle, Spieltag). */
export const allManagers = cache(listAllManagers);

/** Gesamttabelle, je Request nur einmal berechnet (Seitenleiste, Team, Tabelle). */
export const currentLeagueTable = cache(async () =>
  leagueTable(await allManagers()),
);

/** Nur für Admins; alle anderen sehen eine 404, nicht einmal die Existenz der Seite. */
export async function requireAdmin(): Promise<ManagerDoc> {
  const doc = await currentManager();
  if (doc.role !== "admin") notFound();
  return doc;
}

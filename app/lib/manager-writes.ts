// Der eine Schreibweg für bestehende Manager-Dokumente (KONZEPT 7.3): frisch laden,
// ändern, speichern. Neue Konten legt accounts.ts direkt mit saveManager an.
import type { ManagerDoc } from "@fm/core";
import { Conflict, NotFound } from "@/lib/errors";
import { loadManager, saveManager } from "@/lib/storage";

type Change = (doc: ManagerDoc) => ManagerDoc | Promise<ManagerDoc>;

export interface WriteOptions {
  /** Stand, den der Client kennt; weicht das Dokument ab, folgt 409 (veralteter Stand). */
  expect?: string;
  /**
   * Neuer Stempel `updatedAt`, wenn sich Kader, Aufstellung oder Startspieltag ändern:
   * Der Client muss danach neu laden. Ohne Stempel bleibt `updatedAt`, die Änderung
   * betrifft nur server-eigene Felder (Push, Profil, Finalisierung; Entscheidung 25.09.).
   */
  stamp?: Date;
}

async function write(
  doc: ManagerDoc,
  change: Change,
  { expect, stamp }: WriteOptions,
): Promise<ManagerDoc> {
  if (expect !== undefined && doc.updatedAt !== expect) throw new Conflict();
  const next: ManagerDoc = {
    ...(await change(doc)),
    userId: doc.userId,
    updatedAt: stamp ? stamp.toISOString() : doc.updatedAt,
  };
  if (JSON.stringify(next) !== JSON.stringify(doc)) await saveManager(next);
  return next;
}

/** Ändert ein Dokument. Wirft `change`, wird nichts gespeichert. Unbekanntes Konto: 404. */
export async function updateManager(
  userId: string,
  change: Change,
  options: WriteOptions = {},
): Promise<ManagerDoc> {
  const doc = await loadManager(userId);
  if (!doc) throw new NotFound("Konto nicht gefunden");
  return write(doc, change, options);
}

/**
 * Ändert mehrere Dokumente, jedes frisch geladen: Was ein Manager zwischen Liste und
 * Speichern ändert, bleibt erhalten. Inzwischen gelöschte Konten werden übersprungen.
 */
export async function updateManagers(
  userIds: readonly string[],
  change: Change,
  options: Omit<WriteOptions, "expect"> = {},
): Promise<void> {
  for (const userId of userIds) {
    const doc = await loadManager(userId);
    if (doc) await write(doc, change, options);
  }
}

/** Push-Anmeldung entfernen (abgemeldet oder abgelaufen); ohne Konto oder Anmeldung nichts. */
export async function removePush(userId: string): Promise<void> {
  const doc = await loadManager(userId);
  if (!doc?.push) return;
  await write(doc, ({ push: _removed, ...rest }) => rest, {});
}

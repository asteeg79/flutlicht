// Der eine Schreibweg für bestehende Manager-Dokumente (KONZEPT 7.3): frisch laden,
// ändern, nur bei unverändertem Stand speichern (Compare-and-Set). Neue Konten legt
// accounts.ts direkt mit saveManager an.
import {
  DEFAULT_PUSH_PREFS,
  MAX_PUSH_DEVICES,
  type ManagerDoc,
} from "@fm/core";
import { Conflict, NotFound } from "@/lib/errors";
import { loadManagerVersioned, saveManagerIfUnchanged } from "@/lib/storage";

type PushSubscription = NonNullable<
  ManagerDoc["push"]
>["subscriptions"][number];
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

// Versuche, wenn ein anderer Schreiber zwischen Laden und Speichern dazwischenkommt.
const ATTEMPTS = 3;

/**
 * Laden, ändern, nur speichern, wenn das Dokument seit dem Laden unverändert ist
 * (Compare-and-Set); sonst mit dem neuen Stand von vorn. `change` kann deshalb
 * mehrfach laufen und darf nur das Dokument zurückgeben, nichts sonst verändern.
 * null: Konto gibt es nicht (mehr).
 */
async function write(
  userId: string,
  change: Change,
  { expect, stamp }: WriteOptions,
): Promise<ManagerDoc | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const stored = await loadManagerVersioned(userId);
    if (!stored) return null;
    const { doc, version } = stored;
    if (expect !== undefined && doc.updatedAt !== expect) throw new Conflict();
    const next: ManagerDoc = {
      ...(await change(doc)),
      userId: doc.userId,
      updatedAt: stamp ? stamp.toISOString() : doc.updatedAt,
    };
    if (JSON.stringify(next) === JSON.stringify(doc)) return next;
    if (await saveManagerIfUnchanged(next, version)) return next;
  }
  throw new Conflict();
}

/** Ändert ein Dokument. Wirft `change`, wird nichts gespeichert. Unbekanntes Konto: 404. */
export async function updateManager(
  userId: string,
  change: Change,
  options: WriteOptions = {},
): Promise<ManagerDoc> {
  const next = await write(userId, change, options);
  if (!next) throw new NotFound("Konto nicht gefunden");
  return next;
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
  for (const userId of userIds) await write(userId, change, options);
}

/**
 * Gerät für Push anmelden (server-eigen, ohne Stempel). Ein schon bekanntes Gerät
 * (gleicher endpoint) wird ersetzt; über MAX_PUSH_DEVICES fällt das älteste weg.
 */
export function addPushDevice(
  userId: string,
  subscription: PushSubscription,
): Promise<ManagerDoc> {
  return updateManager(userId, (doc) => ({
    ...doc,
    push: {
      subscriptions: [
        ...(doc.push?.subscriptions ?? []).filter(
          (s) => s.endpoint !== subscription.endpoint,
        ),
        subscription,
      ].slice(-MAX_PUSH_DEVICES),
      prefs: doc.push?.prefs ?? DEFAULT_PUSH_PREFS,
    },
  }));
}

/**
 * Geräte abmelden (abgemeldet oder abgelaufen); ohne `endpoints` alle. Bleibt keines,
 * entfällt Push samt Einstellungen. Ohne Konto oder Anmeldung passiert nichts.
 */
export async function removePushDevices(
  userId: string,
  endpoints?: readonly string[],
): Promise<void> {
  await write(
    userId,
    (doc) => {
      if (!doc.push) return doc;
      const rest = endpoints
        ? doc.push.subscriptions.filter((s) => !endpoints.includes(s.endpoint))
        : [];
      if (rest.length > 0)
        return { ...doc, push: { ...doc.push, subscriptions: rest } };
      const { push: _removed, ...withoutPush } = doc;
      return withoutPush;
    },
    {},
  );
}

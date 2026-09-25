import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";
import { promises as fs } from "node:fs";
import path from "node:path";
import { encrypt, decrypt } from "@/lib/crypto";
import type { UserData } from "@/lib/types";

/**
 * Datenhaltung pro User (ein verschlüsselter Wert `user-{userId}-data.json.enc`).
 *
 * Backend-Priorität:
 *  1. Redis (Upstash / Vercel KV)  → STARK KONSISTENT (Read-after-Write sofort),
 *     das Produktions-Backend für geräteübergreifenden Sync.
 *  2. Lokales Dateisystem (`.data/`)  → für Entwicklung/Tests ohne Cloud.
 *     NUR wenn kein Redis konfiguriert ist — nie als Ausweiche bei Redis-Fehlern.
 *
 * (Historie: früher lag der Store in Vercel Blob — nur eventually consistent,
 * daher für Live-Sync ungeeignet. Auf Redis umgestellt und Blob entfernt.)
 */

// Stark konsistenter KV-Store. Wird bevorzugt, sobald Zugangsdaten gesetzt sind.
// Unterstützt BEIDE Varianten, die Vercel/Upstash bereitstellen kann:
//  - REST (HTTPS): UPSTASH_REDIS_REST_URL/_TOKEN bzw. KV_REST_API_URL/_TOKEN
//    → @upstash/redis (serverless-nativ, keine Verbindung).
//  - TCP: REDIS_URL (redis://…/rediss://…) → ioredis.
// get/set/del/keys sind bei beiden Clients signaturkompatibel.
interface KvClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

const restUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const tcpUrl = process.env.REDIS_URL || process.env.KV_URL;

let kv: KvClient | null = null;
if (restUrl && restToken) {
  kv = new UpstashRedis({
    url: restUrl,
    token: restToken,
    // Werte sind verschlüsselte Strings (base64) — kein JSON. Auto-Parsing aus.
    automaticDeserialization: false,
  }) as unknown as KvClient;
} else if (tcpUrl) {
  // lazyConnect: verbindet erst beim ersten Befehl (nicht beim Build/Import).
  kv = new IORedis(tcpUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  }) as unknown as KvClient;
}

// Ohne Redis (lokale Entwicklung/Tests): Ablage im Dateisystem unter .data/.
const LOCAL_DIR = path.join(process.cwd(), ".data");

// --- Low-level Backend-Abstraktion ---

async function localRead(pathname: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(LOCAL_DIR, pathname), "utf8");
  } catch {
    return null;
  }
}

async function localWrite(pathname: string, content: string): Promise<void> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, pathname), content, "utf8");
}

async function localDelete(pathname: string): Promise<void> {
  try {
    await fs.unlink(path.join(LOCAL_DIR, pathname));
  } catch {
    /* ignore */
  }
}

// Redis-Fehler werden bewusst NICHT abgefangen: Ein Lese-Fallback auf das
// (auf Vercel leere) Dateisystem sähe aus wie "keine Daten" → der Client zeigte
// das Onboarding und überschriebe das Konto. Ein Schreib-Fallback meldete
// Erfolg für flüchtigen Speicher → der Client verwürfe sein Backup. Der Fehler
// geht als 500 an den Client, der dann erneut versucht.
async function backendRead(pathname: string): Promise<string | null> {
  if (!kv) return localRead(pathname);
  return (await kv.get(pathname)) as string | null;
}

async function backendWrite(pathname: string, content: string): Promise<void> {
  if (kv) {
    await kv.set(pathname, content);
    return;
  }
  await localWrite(pathname, content);
}

async function backendDelete(pathname: string): Promise<void> {
  if (kv) {
    await kv.del(pathname);
    return;
  }
  await localDelete(pathname);
}

interface Entry {
  pathname: string;
  content: string;
}

/** Gibt [pathname, content] für alle Einträge mit Prefix und Suffix zurück. */
function backendListContents(prefix: string, suffix: string): Promise<Entry[]> {
  if (kv) return redisList(kv, prefix, suffix);
  return localList(prefix, suffix);
}

async function redisList(
  client: KvClient,
  prefix: string,
  suffix: string,
): Promise<Entry[]> {
  // Nur passende Keys laden (der Prefix trifft z. B. auch die Token-Blobs) und
  // die GETs parallel statt nacheinander.
  const keys = (await client.keys(`${prefix}*`)).filter((k) =>
    k.endsWith(suffix),
  );
  const contents = await Promise.all(
    keys.map((k) => client.get(k) as Promise<string | null>),
  );
  return keys.flatMap((k, i) => {
    const content = contents[i];
    return content != null ? [{ pathname: k, content }] : [];
  });
}

async function localList(prefix: string, suffix: string): Promise<Entry[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(LOCAL_DIR);
  } catch {
    return [];
  }
  const result: Entry[] = [];
  for (const f of files) {
    if (!f.startsWith(prefix) || !f.endsWith(suffix)) continue;
    const content = await fs.readFile(path.join(LOCAL_DIR, f), "utf8");
    result.push({ pathname: f, content });
  }
  return result;
}

// --- Öffentliche API ---

/**
 * Welches Backend beim Import gewählt wurde. Einzige Quelle der Wahrheit für
 * diese Frage — der Health-Check darf die Env-Bedingungen nicht nachbauen.
 */
export function storageBackend(): "redis" | "local" {
  return kv ? "redis" : "local";
}

/**
 * Liest und entschlüsselt ein JSON-Objekt. null NUR, wenn es nicht existiert.
 * Ein unlesbarer Stand (Entschlüsselung oder JSON kaputt, z. B. nach
 * Schlüsselwechsel) wirft: als null sähe er aus wie "leer" → der nächste Save
 * überschriebe die (evtl. wiederherstellbaren) Daten endgültig.
 */
async function readEncrypted<T>(
  pathname: string,
  key: string,
): Promise<T | null> {
  const encrypted = await backendRead(pathname);
  if (!encrypted) return null;
  try {
    return JSON.parse(decrypt(encrypted, key)) as T;
  } catch (err) {
    throw new Error(`${pathname} nicht lesbar`, { cause: err });
  }
}

async function writeEncrypted(
  pathname: string,
  key: string,
  value: unknown,
): Promise<void> {
  await backendWrite(pathname, encrypt(JSON.stringify(value), key));
}

const USER_DATA_SUFFIX = "-data.json.enc";

function userDataPath(userId: string): string {
  return `user-${userId}${USER_DATA_SUFFIX}`;
}

/** null = neues Konto (Client zeigt Onboarding) — deshalb wirft Unlesbares. */
export function loadUserData(userId: string): Promise<UserData | null> {
  return readEncrypted<UserData>(userDataPath(userId), userId);
}

export function saveUserData(userId: string, data: UserData): Promise<void> {
  return writeEncrypted(userDataPath(userId), userId, data);
}

export async function deleteUserData(userId: string): Promise<void> {
  await backendDelete(userDataPath(userId));
}

/** Iteriert über alle User-Daten-Einträge (für den Push-Cron-Job). */
export async function listAllUserData(): Promise<UserData[]> {
  const entries = await backendListContents("user-", USER_DATA_SUFFIX);
  const result: UserData[] = [];
  for (const { pathname, content } of entries) {
    const match = /^user-(.+)-data\.json\.enc$/.exec(pathname);
    if (!match) continue;
    const userId = match[1];
    try {
      result.push(JSON.parse(decrypt(content, userId)) as UserData);
    } catch (err) {
      console.error(`Konnte ${pathname} nicht lesen:`, err);
    }
  }
  return result;
}

// --- Passkey-Index (global, credentialID -> User) ---
// Mit konstantem Schlüssel verschlüsselt, da der Index über alle User geht.

const PASSKEY_INDEX_PATH = "passkey-index.json.enc";
const PASSKEY_INDEX_KEY = "__passkey_index__";

export interface PasskeyIndexEntry {
  userId: string;
  email: string;
  name?: string;
  image?: string;
}

export type PasskeyIndex = Record<string, PasskeyIndexEntry>;

export async function loadPasskeyIndex(): Promise<PasskeyIndex> {
  return (
    (await readEncrypted<PasskeyIndex>(
      PASSKEY_INDEX_PATH,
      PASSKEY_INDEX_KEY,
    )) ?? {}
  );
}

export function savePasskeyIndex(index: PasskeyIndex): Promise<void> {
  return writeEncrypted(PASSKEY_INDEX_PATH, PASSKEY_INDEX_KEY, index);
}

// --- Google OAuth Tokens (für Kalender-Sync, serverseitig, verschlüsselt) ---

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix-Sekunden
  scope?: string;
}

function googleTokenPath(userId: string): string {
  return `user-${userId}-google.json.enc`;
}

/** Unlesbare Tokens gelten als "nicht verbunden" — sie sind durch erneutes
 *  Verbinden ersetzbar und ihr Überschreiben verliert nichts. */
export function loadGoogleTokens(userId: string): Promise<GoogleTokens | null> {
  return readEncrypted<GoogleTokens>(googleTokenPath(userId), userId).catch(
    (err) => {
      console.error(err);
      return null;
    },
  );
}

export async function saveGoogleTokens(
  userId: string,
  tokens: GoogleTokens,
): Promise<void> {
  // Merge: Google sendet das refresh_token nur beim ersten Consent. Bei späteren
  // Logins (ohne prompt:consent) fehlt es — dann das gespeicherte behalten,
  // statt es zu überschreiben. Gleiches gilt für scope/expiresAt.
  const existing = await loadGoogleTokens(userId);
  const merged: GoogleTokens = {
    accessToken: tokens.accessToken || existing?.accessToken || "",
    refreshToken: tokens.refreshToken ?? existing?.refreshToken,
    expiresAt: tokens.expiresAt ?? existing?.expiresAt,
    scope: tokens.scope ?? existing?.scope,
  };
  await writeEncrypted(googleTokenPath(userId), userId, merged);
}

export async function deleteGoogleTokens(userId: string): Promise<void> {
  await backendDelete(googleTokenPath(userId));
}

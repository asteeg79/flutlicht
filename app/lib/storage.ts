// Übernommen aus Workgrid lib/storage.ts, angepasst: nur Upstash-REST (kein ioredis),
// Google-Token- und Passkey-Teil entfernt, Manager-Dokument/E-Mail-Index/Liga nach
// demselben Muster, Validierung mit den core-Schemas, lokales Verzeichnis per Env.
import { Redis as UpstashRedis } from "@upstash/redis";
import { promises as fs } from "node:fs";
import path from "node:path";
import { EmailIndex, League, ManagerDoc, SystemState } from "@fm/core";
import type { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto";

/**
 * Datenhaltung der Manager (KONZEPT 7.3), je Dokument AES-GCM-verschlüsselt.
 *
 * Backend:
 *  1. Upstash Redis → stark konsistent, das Produktions-Backend.
 *  2. Lokales Dateisystem (FM_LOCAL_DATA_DIR bzw. `.data/`) → Entwicklung/Tests.
 *     NUR wenn kein Redis konfiguriert ist, nie als Ausweiche bei Redis-Fehlern.
 */
interface KvClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  mget(...keys: string[]): Promise<(string | null)[]>;
}

// KV_REST_API_* setzt die Vercel-Marketplace-Integration „Upstash for Redis“.
const restUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const restToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const kv: KvClient | null =
  restUrl && restToken
    ? (new UpstashRedis({
        url: restUrl,
        token: restToken,
        // Werte sind verschlüsselte Strings (base64), kein JSON.
        automaticDeserialization: false,
      }) as unknown as KvClient)
    : null;

function localDir(): string {
  return process.env.FM_LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data");
}

// --- Low-level Backend-Abstraktion ---

async function localRead(pathname: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(localDir(), pathname), "utf8");
  } catch {
    return null;
  }
}

async function localDelete(pathname: string): Promise<void> {
  await fs.rm(path.join(localDir(), pathname), { force: true });
}

async function localWrite(pathname: string, content: string): Promise<void> {
  await fs.mkdir(localDir(), { recursive: true });
  await fs.writeFile(path.join(localDir(), pathname), content, "utf8");
}

// Redis-Fehler werden bewusst NICHT abgefangen: Ein Lese-Fallback sähe aus wie
// "keine Daten" und der nächste Save überschriebe das Konto.
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

async function backendListContents(
  prefix: string,
  suffix: string,
): Promise<Entry[]> {
  if (kv) {
    const keys = (await kv.keys(`${prefix}*`)).filter((k) =>
      k.endsWith(suffix),
    );
    // Ein MGET statt je Schlüssel ein GET: ein Befehl im Upstash-Kontingent.
    const contents = keys.length > 0 ? await kv.mget(...keys) : [];
    return keys.flatMap((k, i) => {
      const content = contents[i];
      return content != null ? [{ pathname: k, content }] : [];
    });
  }
  let files: string[];
  try {
    files = await fs.readdir(localDir());
  } catch {
    return [];
  }
  const result: Entry[] = [];
  for (const f of files) {
    if (!f.startsWith(prefix) || !f.endsWith(suffix)) continue;
    result.push({
      pathname: f,
      content: await fs.readFile(path.join(localDir(), f), "utf8"),
    });
  }
  return result;
}

// --- Öffentliche API ---

export function storageBackend(): "redis" | "local" {
  return kv ? "redis" : "local";
}

/**
 * Liest, entschlüsselt und validiert. null NUR, wenn es nicht existiert.
 * Unlesbares wirft: als null sähe es aus wie "leer" und würde überschrieben.
 */
async function readEncrypted<T>(
  pathname: string,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const encrypted = await backendRead(pathname);
  if (!encrypted) return null;
  try {
    return schema.parse(JSON.parse(decrypt(encrypted, key)));
  } catch (err) {
    throw new Error(`${pathname} nicht lesbar`, { cause: err });
  }
}

async function writeEncrypted<T>(
  pathname: string,
  key: string,
  schema: z.ZodType<T>,
  value: T,
): Promise<void> {
  await backendWrite(
    pathname,
    encrypt(JSON.stringify(schema.parse(value)), key),
  );
}

const USER_DATA_SUFFIX = "-data.json.enc";

function managerPath(userId: string): string {
  return `user-${userId}${USER_DATA_SUFFIX}`;
}

export function loadManager(userId: string): Promise<ManagerDoc | null> {
  return readEncrypted(managerPath(userId), userId, ManagerDoc);
}

export function saveManager(doc: ManagerDoc): Promise<void> {
  return writeEncrypted(managerPath(doc.userId), doc.userId, ManagerDoc, doc);
}

/** Konto löschen (KONZEPT 15.4); den E-Mail-Index räumt der Aufrufer auf. */
export async function deleteManager(userId: string): Promise<void> {
  await backendDelete(managerPath(userId));
}

/** Alle Manager-Dokumente (Tabelle, Tick). Unlesbares wird geloggt und übersprungen. */
export async function listAllManagers(): Promise<ManagerDoc[]> {
  const entries = await backendListContents("user-", USER_DATA_SUFFIX);
  const result: ManagerDoc[] = [];
  for (const { pathname, content } of entries) {
    const match = /^user-(.+)-data\.json\.enc$/.exec(pathname);
    if (!match) continue;
    try {
      result.push(ManagerDoc.parse(JSON.parse(decrypt(content, match[1]!))));
    } catch (err) {
      console.error(`Konnte ${pathname} nicht lesen:`, err);
    }
  }
  return result;
}

// --- Globale Dokumente, mit konstantem Schlüssel verschlüsselt ---

const EMAIL_INDEX_PATH = "email-index.json.enc";
const EMAIL_INDEX_KEY = "__email_index__";
const LEAGUE_PATH = "league.json.enc";
const LEAGUE_KEY = "__league__";
const SYSTEM_STATE_PATH = "system-state.json.enc";
const SYSTEM_STATE_KEY = "__system_state__";

/** { [emailLower]: userId } */
export async function loadEmailIndex(): Promise<EmailIndex> {
  return (
    (await readEncrypted(EMAIL_INDEX_PATH, EMAIL_INDEX_KEY, EmailIndex)) ?? {}
  );
}

export function saveEmailIndex(index: EmailIndex): Promise<void> {
  return writeEncrypted(EMAIL_INDEX_PATH, EMAIL_INDEX_KEY, EmailIndex, index);
}

export async function loadLeague(): Promise<League> {
  return (
    (await readEncrypted(LEAGUE_PATH, LEAGUE_KEY, League)) ?? {
      invites: [],
      resets: [],
    }
  );
}

export function saveLeague(league: League): Promise<void> {
  return writeEncrypted(LEAGUE_PATH, LEAGUE_KEY, League, league);
}

/** Tick-Idempotenz: ausgeführte Aktionen (KONZEPT 9). */
export async function loadSystemState(): Promise<SystemState> {
  return (
    (await readEncrypted(SYSTEM_STATE_PATH, SYSTEM_STATE_KEY, SystemState)) ?? {
      done: {},
    }
  );
}

export function saveSystemState(state: SystemState): Promise<void> {
  return writeEncrypted(
    SYSTEM_STATE_PATH,
    SYSTEM_STATE_KEY,
    SystemState,
    state,
  );
}

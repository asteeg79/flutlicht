// Übernommen aus Workgrid lib/rate-limit.ts, angepasst: Prefix fm-rl, zusätzliches
// Limit für Login/Registrierung/Reset (10 Versuche pro 15 Min. pro IP, KONZEPT 8.3).
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * - Mit Upstash-Zugangsdaten: verteiltes Sliding Window über alle Instanzen.
 * - Ohne: In-Memory-Fallback (best effort pro Instanz, für lokale Entwicklung).
 */
export type LimitKind = "api" | "auth";

const LIMITS: Record<
  LimitKind,
  { max: number; windowMs: number; window: `${number} m` }
> = {
  api: {
    max: Number(process.env.RATE_LIMIT_PER_MIN ?? 100),
    windowMs: 60_000,
    window: "1 m",
  },
  auth: {
    max: Number(process.env.AUTH_RATE_LIMIT ?? 10),
    windowMs: 15 * 60_000,
    window: "15 m",
  },
};

const upstash = new Map<LimitKind, Ratelimit | null>();

function getUpstash(kind: LimitKind): Ratelimit | null {
  if (upstash.has(kind)) return upstash.get(kind)!;
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const limiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(
            LIMITS[kind].max,
            LIMITS[kind].window,
          ),
          prefix: kind === "api" ? "fm-rl" : "fm-rl-auth",
          analytics: false,
        })
      : null;
  upstash.set(kind, limiter);
  return limiter;
}

// In-Memory-Fallback
const hits = new Map<string, number[]>();

function memoryLimited(kind: LimitKind, ip: string): boolean {
  const { max, windowMs } = LIMITS[kind];
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  timestamps.push(now);
  hits.set(key, timestamps);
  if (hits.size > 5000) {
    hits.forEach((ts, k) => {
      if (ts.every((t) => t <= now - windowMs)) hits.delete(k);
    });
  }
  return timestamps.length > max;
}

/** true, wenn die IP das Limit der Art überschritten hat. */
export async function isRateLimited(
  ip: string,
  kind: LimitKind = "api",
): Promise<boolean> {
  const limiter = getUpstash(kind);
  if (limiter) return !(await limiter.limit(ip)).success;
  return memoryLimited(kind, ip);
}

/** POST-Routen mit dem strengen Auth-Limit. */
export const AUTH_LIMITED_PATHS = [
  "/api/auth/callback/credentials",
  "/api/auth/register",
  "/api/auth/reset",
] as const;

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate Limiting für /api/* (Spec Abschnitt 8: 100 req/min pro IP).
 *
 * - Mit Upstash/Vercel-KV-Credentials: verteiltes Sliding-Window über alle
 *   Edge-Instanzen (produktionstauglich).
 * - Ohne Credentials: In-Memory-Fallback (best-effort pro Instanz, für lokale
 *   Entwicklung). Cloudflare WAF bleibt die primäre Verteidigung.
 */

const LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? 100);
const WINDOW_MS = 60_000;

let upstash: Ratelimit | null | undefined;

function getUpstash(): Ratelimit | null {
  if (upstash !== undefined) return upstash;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    upstash = null;
    return null;
  }
  upstash = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(LIMIT, "60 s"),
    prefix: "mwg-rl",
    analytics: false,
  });
  return upstash;
}

// In-Memory-Fallback
const hits = new Map<string, number[]>();

function memoryLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);

  if (hits.size > 5000) {
    hits.forEach((ts, key) => {
      if (ts.every((t) => t <= windowStart)) hits.delete(key);
    });
  }

  return timestamps.length > LIMIT;
}

/** Gibt true zurück, wenn die IP das Limit überschritten hat. */
export async function isRateLimited(ip: string): Promise<boolean> {
  const limiter = getUpstash();
  if (limiter) {
    const { success } = await limiter.limit(ip);
    return !success;
  }
  return memoryLimited(ip);
}

// Übernommen aus WM-Tipp pipeline/src/sources/http.ts, angepasst: nur fetchJson (für OpenLigaDB).
import { sleep } from "../util/async";
/**
 * Schlanker HTTP-JSON-Client mit exponentiellem Backoff für 429/5xx.
 * Wird für OpenLigaDB genutzt; respektiert Rate-Limits und Retry-After.
 */

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  maxRetries: number;
  backoffBaseMs: number;
  /** Optionaler Timeout pro Versuch (ms). */
  timeoutMs?: number;
}

/**
 * Signalisiert dem Retry-Loop einen erneuten Versuch mit EXPLIZITER Wartezeit
 * (z. B. aus dem `Retry-After`-Header). Ohne dieses Signal geworfene Fehler
 * werden mit dem Standard-Backoff wiederholt.
 */
class RetrySignal {
  constructor(
    readonly waitMs: number,
    readonly err: Error,
  ) {}
}

/**
 * Führt einen Request bis zu `maxRetries`+1-mal aus. `handle` liefert das
 * Ergebnis, wirft `RetrySignal` für einen Retry mit fester Wartezeit oder einen
 * beliebigen Fehler (→ Retry mit Backoff+Jitter; nach dem letzten Versuch neu
 * geworfen). AbortController + Timeout gelten pro Versuch.
 */
async function fetchWithRetry<T>(
  url: string,
  opts: FetchJsonOptions,
  label: string,
  handle: (res: Response) => Promise<T>,
): Promise<T> {
  const { headers, maxRetries, backoffBaseMs, timeoutMs = 25_000 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: headers ?? {},
        signal: controller.signal,
      });
      return await handle(res);
    } catch (err) {
      const backoff = backoffBaseMs * 2 ** attempt + Math.random() * 250;
      const wait = err instanceof RetrySignal ? err.waitMs : backoff;
      lastErr = err instanceof RetrySignal ? err.err : err;
      if (attempt < maxRetries) {
        await sleep(wait);
        continue;
      }
      throw lastErr;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error(`${label} fehlgeschlagen: ${url}`);
}

/**
 * Holt JSON von `url`. Wiederholt bei 429 und 5xx mit exponentiellem Backoff
 * (+Jitter); respektiert dabei einen vorhandenen `Retry-After`-Header. Wirft
 * bei endgültigem Fehlschlag.
 */
export function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions,
): Promise<T> {
  return fetchWithRetry<T>(url, opts, "fetchJson", async (res) => {
    if (res.status === 429 || res.status >= 500) {
      const err = new Error(`HTTP ${res.status} für ${url}`);
      // Rate-Limit oder Serverfehler → Backoff; Retry-After bevorzugen.
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        throw new RetrySignal(retryAfter * 1000, err);
      }
      throw err;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} für ${url}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  });
}

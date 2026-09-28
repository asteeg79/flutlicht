// Übernommen aus WM-Tipp pipeline/src/sources/http.ts, angepasst: nur fetchJson (für OpenLigaDB),
// eine Schleife statt Retry-Gerüst, 4xx außer 429 ohne Wiederholung.
import { sleep } from "../util/async";

export interface FetchJsonOptions {
  maxRetries: number;
  backoffBaseMs: number;
  /** Timeout pro Versuch (ms). */
  timeoutMs?: number;
}

/**
 * Holt JSON von `url`. Wiederholt bei 429, 5xx, Netzfehlern und Timeouts mit
 * exponentiellem Backoff (+Jitter), bei vorhandenem `Retry-After` so lange wie
 * verlangt. Andere 4xx werfen sofort; nach dem letzten Versuch wirft der letzte Fehler.
 */
export async function fetchJson<T = unknown>(
  url: string,
  { maxRetries, backoffBaseMs, timeoutMs = 25_000 }: FetchJsonOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let wait = backoffBaseMs * 2 ** attempt + Math.random() * 250;
    let res: Response | undefined;
    let error: unknown;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      error = err; // Netzfehler oder Timeout
    }
    if (res) {
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`HTTP ${res.status} für ${url}: ${await res.text()}`);
      }
      error = new Error(`HTTP ${res.status} für ${url}`);
      const retryAfter = Number(res.headers.get("retry-after"));
      if (retryAfter > 0) wait = retryAfter * 1000;
    }
    if (attempt >= maxRetries) throw error;
    await sleep(wait);
  }
}

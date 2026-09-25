// Übernommen aus WM-Tipp pipeline/src/util/async.ts, angepasst: nur sleep.

/** Promise-basiertes Warten. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

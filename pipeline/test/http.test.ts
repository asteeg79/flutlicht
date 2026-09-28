import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "../src/sources/http";

afterEach(() => vi.unstubAllGlobals());

const opts = { maxRetries: 2, backoffBaseMs: 0 };
const stub = (...responses: (Response | Error)[]) => {
  const fetch = vi.fn(async () => {
    const r = responses.shift()!;
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

describe("fetchJson", () => {
  it("wiederholt 429, 5xx und Netzfehler", async () => {
    const fetch = stub(
      new Response(null, { status: 503 }),
      new Error("ECONNRESET"),
      Response.json([1]),
    );
    expect(await fetchJson("https://x", opts)).toEqual([1]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("gibt nach maxRetries auf und wirft den letzten Fehler", async () => {
    const fetch = stub(
      new Response(null, { status: 429 }),
      new Response(null, { status: 500 }),
      new Response(null, { status: 502 }),
    );
    await expect(fetchJson("https://x", opts)).rejects.toThrow(
      "HTTP 502 für https://x",
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("wiederholt 4xx nicht", async () => {
    const fetch = stub(new Response("weg", { status: 404 }));
    await expect(fetchJson("https://x", opts)).rejects.toThrow(
      "HTTP 404 für https://x: weg",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("wartet so lange, wie Retry-After verlangt", async () => {
    vi.useFakeTimers();
    try {
      stub(
        new Response(null, { status: 429, headers: { "retry-after": "7" } }),
        Response.json({ ok: true }),
      );
      const result = fetchJson("https://x", opts);
      await vi.advanceTimersByTimeAsync(6_999);
      let done = false;
      void result.then(() => (done = true));
      await Promise.resolve();
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });
});

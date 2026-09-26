import { afterEach, expect, it, vi } from "vitest";

// Die Vercel-Marketplace-Integration „Upstash for Redis“ setzt KV_REST_API_*, nicht UPSTASH_REDIS_REST_*.
vi.mock("@upstash/redis", () => ({ Redis: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("nimmt Redis auch mit den Variablen der Vercel-Integration", async () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("KV_REST_API_URL", "https://kv.example");
  vi.stubEnv("KV_REST_API_TOKEN", "kv-token");
  const { storageBackend } = await import("@/lib/storage");
  const { Redis } = await import("@upstash/redis");
  expect(storageBackend()).toBe("redis");
  expect(Redis).toHaveBeenCalledWith(
    expect.objectContaining({ url: "https://kv.example", token: "kv-token" }),
  );
});

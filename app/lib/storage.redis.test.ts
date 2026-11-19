import { afterEach, beforeEach, expect, it, vi } from "vitest";

// Nachbau des Upstash-Clients: GET/SET auf einer Map, EVAL führt das Compare-and-Set
// so aus, wie es das Lua-Skript in lib/storage.ts beschreibt (ARGV[1] erwartet, ARGV[2] neu).
const store = new Map<string, string>();
const evals: { keys: string[]; args: string[] }[] = [];
vi.mock("@upstash/redis", () => ({
  Redis: class {
    async get(key: string) {
      return store.get(key) ?? null;
    }
    async set(key: string, value: string) {
      store.set(key, value);
      return "OK";
    }
    async eval(script: string, keys: string[], args: string[]) {
      expect(script).toContain('redis.call("GET", KEYS[1]) == ARGV[1]');
      evals.push({ keys, args });
      if (store.get(keys[0]!) !== args[0]) return 0;
      store.set(keys[0]!, args[1]!);
      return 1;
    }
  },
}));

beforeEach(() => {
  store.clear();
  evals.length = 0;
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv.example");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "kv-token");
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("Redis: schreibt nur, wenn der geladene Stand noch gilt (ein EVAL)", async () => {
  const storage = await import("@/lib/storage");
  const { saveDoc } = await import("@/test/fixtures");
  expect(storage.storageBackend()).toBe("redis");
  const doc = await saveDoc();
  const loaded = (await storage.loadManagerVersioned(doc.userId))!;

  expect(
    await storage.saveManagerIfUnchanged({ ...doc, cash: 10 }, loaded.version),
  ).toBe(true);
  expect(evals[0]!.keys).toEqual([`user-${doc.userId}-data.json.enc`]);
  expect(evals[0]!.args[0]).toBe(loaded.version);
  expect((await storage.loadManager(doc.userId))?.cash).toBe(10);

  // Der alte Stand gilt nicht mehr: nichts geschrieben.
  expect(
    await storage.saveManagerIfUnchanged({ ...doc, cash: 1 }, loaded.version),
  ).toBe(false);
  expect((await storage.loadManager(doc.userId))?.cash).toBe(10);
});

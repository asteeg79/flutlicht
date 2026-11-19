import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-writes-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
});

// NextAuth wird hier nicht gebraucht (die Fehlerklassen kommen aus lib/api-route).
vi.mock("@/lib/auth", () => ({ auth: async () => null }));

const { removePush, updateManager, updateManagers } =
  await import("@/lib/manager-writes");
const { BadRequest, Conflict, NotFound } = await import("@/lib/api-route");
const storage = await import("@/lib/storage");
const { saveDoc, UPDATED } = await import("@/test/fixtures");

const NOW = new Date("2026-11-19T12:00:00.000Z");
const OTHER = "22222222-2222-4222-8222-222222222222";
const PUSH = {
  subscription: {
    endpoint: "https://push.example.org/1",
    keys: { p256dh: "p", auth: "a" },
  },
  prefs: { reminder: true, daily: false, final: true },
};

describe("updateManager: ein Schreibweg für das Manager-Dokument", () => {
  it("Änderung des Nutzers: prüft seinen Stand und setzt den neuen Stempel", async () => {
    const doc = await saveDoc();
    const next = await updateManager(doc.userId, (d) => ({ ...d, cash: 10 }), {
      expect: UPDATED,
      stamp: NOW,
    });
    expect(next).toMatchObject({ cash: 10, updatedAt: NOW.toISOString() });
    expect(await storage.loadManager(doc.userId)).toEqual(next);
  });

  it("veralteter Stand des Clients: 409, nichts gespeichert", async () => {
    const doc = await saveDoc();
    await expect(
      updateManager(doc.userId, (d) => ({ ...d, cash: 10 }), {
        expect: "2026-09-01T00:00:00.000Z",
        stamp: NOW,
      }),
    ).rejects.toBeInstanceOf(Conflict);
    expect(await storage.loadManager(doc.userId)).toEqual(doc);
  });

  it("server-eigene Felder: updatedAt bleibt, auch wenn die Änderung es setzt", async () => {
    const doc = await saveDoc();
    const next = await updateManager(doc.userId, (d) => ({
      ...d,
      push: PUSH,
      updatedAt: NOW.toISOString(),
    }));
    expect(next.updatedAt).toBe(UPDATED);
    expect((await storage.loadManager(doc.userId))?.push).toEqual(PUSH);
  });

  it("wirft die Änderung, bleibt das Dokument unverändert", async () => {
    const doc = await saveDoc();
    await expect(
      updateManager(doc.userId, () => {
        throw new BadRequest("nein");
      }),
    ).rejects.toBeInstanceOf(BadRequest);
    expect(await storage.loadManager(doc.userId)).toEqual(doc);
  });

  it("unbekanntes Konto: 404", async () => {
    await expect(
      updateManager(OTHER, (d) => d, { stamp: NOW }),
    ).rejects.toBeInstanceOf(NotFound);
  });
});

describe("updateManagers", () => {
  it("liest jedes Dokument frisch: eine Änderung zwischendurch geht nicht verloren", async () => {
    const tom = await saveDoc();
    const ana = await saveDoc({ userId: OTHER, email: "ana@example.org" });
    let first = true;
    await updateManagers(
      [tom.userId, ana.userId],
      async (d) => {
        if (first) {
          first = false;
          // Während der Admin alle Konten umschreibt, ändert der andere Manager sein Dokument.
          const other = d.userId === tom.userId ? ana.userId : tom.userId;
          const current = (await storage.loadManager(other))!;
          await storage.saveManager({ ...current, teamName: "Neu" });
        }
        return { ...d, firstMatchday: 9 };
      },
      { stamp: NOW },
    );
    const after = await storage.listAllManagers();
    expect(after.map((d) => d.firstMatchday)).toEqual([9, 9]);
    expect(after.map((d) => d.updatedAt)).toEqual([
      NOW.toISOString(),
      NOW.toISOString(),
    ]);
    expect(after.some((d) => d.teamName === "Neu")).toBe(true);
  });

  it("überspringt inzwischen gelöschte Konten", async () => {
    const tom = await saveDoc();
    await updateManagers([OTHER, tom.userId], (d) => ({ ...d, cash: 1 }));
    expect((await storage.loadManager(tom.userId))?.cash).toBe(1);
  });
});

describe("removePush", () => {
  it("entfernt die Anmeldung, ohne den Stempel zu ändern", async () => {
    const doc = await saveDoc({ push: PUSH });
    await removePush(doc.userId);
    const after = await storage.loadManager(doc.userId);
    expect(after?.push).toBeUndefined();
    expect(after?.updatedAt).toBe(UPDATED);
  });

  it("ohne Konto oder ohne Anmeldung passiert nichts", async () => {
    await expect(removePush(OTHER)).resolves.toBeUndefined();
    const doc = await saveDoc();
    await removePush(doc.userId);
    expect(await storage.loadManager(doc.userId)).toEqual(doc);
  });
});

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  vi.stubEnv("FM_LOCAL_DATA_DIR", await mkdtemp(join(tmpdir(), "fm-writes-")));
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
});

const { addPushDevice, removePushDevices, updateManager, updateManagers } =
  await import("@/lib/manager-writes");
const { BadRequest, Conflict, NotFound } = await import("@/lib/errors");
const storage = await import("@/lib/storage");
const { saveDoc, UPDATED } = await import("@/test/fixtures");

const NOW = new Date("2026-11-19T12:00:00.000Z");
const OTHER = "22222222-2222-4222-8222-222222222222";
const device = (n: number) => ({
  endpoint: `https://push.example.org/${n}`,
  keys: { p256dh: "p", auth: "a" },
});
const PUSH = {
  subscriptions: [device(1)],
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
          // Während der Admin alle Konten umschreibt, ändert der andere Manager sein
          // Dokument, wie jede Änderung über den Schreibweg (Compare-and-Set).
          const other = d.userId === tom.userId ? ana.userId : tom.userId;
          await updateManager(other, (o) => ({ ...o, teamName: "Neu" }));
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

describe("Push je Gerät", () => {
  it("meldet weitere Geräte an, ein bekanntes ersetzt, Einstellungen bleiben", async () => {
    const doc = await saveDoc({ push: PUSH });
    await addPushDevice(doc.userId, device(2));
    const renewed = { ...device(1), keys: { p256dh: "neu", auth: "neu" } };
    const next = await addPushDevice(doc.userId, renewed);
    expect(next.push).toEqual({
      subscriptions: [device(2), renewed],
      prefs: PUSH.prefs,
    });
    expect(next.updatedAt).toBe(UPDATED);
  });

  it("erstes Gerät bekommt alle Benachrichtigungen, mehr als zehn verdrängen das älteste", async () => {
    const doc = await saveDoc();
    for (let n = 1; n <= 11; n++) await addPushDevice(doc.userId, device(n));
    const push = (await storage.loadManager(doc.userId))!.push!;
    expect(push.prefs).toEqual({ reminder: true, daily: true, final: true });
    expect(push.subscriptions.map((s) => s.endpoint.split("/").pop())).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
    ]);
  });

  it("meldet ein Gerät ab, die anderen bleiben; ohne Gerät entfällt Push", async () => {
    const doc = await saveDoc({
      push: { ...PUSH, subscriptions: [device(1), device(2)] },
    });
    await removePushDevices(doc.userId, [device(1).endpoint]);
    expect(
      (await storage.loadManager(doc.userId))?.push?.subscriptions,
    ).toEqual([device(2)]);
    await removePushDevices(doc.userId, [device(2).endpoint]);
    const after = await storage.loadManager(doc.userId);
    expect(after?.push).toBeUndefined();
    expect(after?.updatedAt).toBe(UPDATED);
  });

  it("ohne Angabe alle Geräte; ohne Konto oder Anmeldung passiert nichts", async () => {
    await expect(removePushDevices(OTHER)).resolves.toBeUndefined();
    const doc = await saveDoc({ push: PUSH });
    await removePushDevices(doc.userId);
    expect((await storage.loadManager(doc.userId))?.push).toBeUndefined();
    const plain = await saveDoc({ userId: OTHER, email: "ana@example.org" });
    await removePushDevices(OTHER);
    expect(await storage.loadManager(OTHER)).toEqual(plain);
  });
});

describe("Compare-and-Set: gleichzeitige Änderungen am selben Dokument", () => {
  it("eine Änderung dazwischen bleibt erhalten, die eigene wird neu angewendet", async () => {
    const doc = await saveDoc();
    let calls = 0;
    const next = await updateManager(doc.userId, async (d) => {
      calls++;
      if (calls === 1) {
        // Ein anderer Schreiber (etwa die Push-Anmeldung) kommt dazwischen.
        await storage.saveManager({ ...d, push: PUSH });
      }
      return { ...d, cash: 10 };
    });
    expect(calls).toBe(2);
    expect(next).toMatchObject({ cash: 10, push: PUSH });
    expect(await storage.loadManager(doc.userId)).toEqual(next);
  });

  it("hat der Nutzer selbst dazwischen gespeichert, ist sein alter Stand veraltet: 409", async () => {
    const doc = await saveDoc();
    let calls = 0;
    await expect(
      updateManager(
        doc.userId,
        async (d) => {
          calls++;
          if (calls === 1)
            await storage.saveManager({ ...d, updatedAt: NOW.toISOString() });
          return { ...d, cash: 10 };
        },
        { expect: UPDATED, stamp: NOW },
      ),
    ).rejects.toBeInstanceOf(Conflict);
    expect((await storage.loadManager(doc.userId))?.cash).toBe(85);
  });

  it("dauerhaft parallele Änderungen: nach drei Versuchen 409", async () => {
    const doc = await saveDoc();
    let calls = 0;
    await expect(
      updateManager(doc.userId, async (d) => {
        calls++;
        await storage.saveManager({ ...d, teamName: `Neu ${calls}` });
        return { ...d, cash: 10 };
      }),
    ).rejects.toBeInstanceOf(Conflict);
    expect(calls).toBe(3);
    expect((await storage.loadManager(doc.userId))?.cash).toBe(85);
  });
});

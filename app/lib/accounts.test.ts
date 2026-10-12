import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Lokaler Storage in einem frischen Verzeichnis je Test (Workgrid-Muster: kein Redis im Test).
beforeEach(async () => {
  vi.stubEnv(
    "FM_LOCAL_DATA_DIR",
    await mkdtemp(join(tmpdir(), "fm-accounts-")),
  );
  vi.stubEnv("APP_ENCRYPTION_SECRET", "test-secret-00000000000000000000");
  vi.stubEnv("ADMIN_EMAILS", "Alex@Example.org, other@example.org");
});

// NextAuth selbst wird hier nicht gebraucht, nur authorizeCredentials.
vi.mock("next-auth", () => ({ default: () => ({}) }));

const { registerManager, resetPassword, updateProfile } =
  await import("@/lib/accounts");
const { authorizeCredentials } = await import("@/lib/auth");
const storage = await import("@/lib/storage");
const { finals, gameData } = await import("@/lib/game-data");
const { firstMatchdayFor } = await import("@fm/core");

const NOW = new Date("2026-09-25T12:00:00Z");
const input = (over: Record<string, unknown> = {}) => ({
  email: "Tom@Example.org ",
  password: "zehn-zeichen",
  displayName: "Tom",
  teamName: "Flutlicht FC",
  inviteCode: "abcd 2345",
  ...over,
});

async function seedInvites(...codes: string[]) {
  await storage.saveLeague({
    invites: (codes.length ? codes : ["ABCD2345"]).map((code) => ({
      code,
      createdAt: NOW.toISOString(),
    })),
    resets: [],
  });
}

describe("registerManager (KONZEPT 8.2)", () => {
  it("legt mit gültigem Code einen Manager an und verbraucht den Code", async () => {
    await seedInvites();
    const doc = await registerManager(input(), NOW);
    // Echte Daten: Der Einstieg hängt davon ab, welche Spieltage schon final sind (core/league.test.ts).
    const firstMatchday = firstMatchdayFor(
      gameData.fixtures,
      finals(),
      NOW,
      gameData.season.firstScoredMatchday,
    );
    expect(doc).toMatchObject({
      email: "tom@example.org",
      role: "player",
      squad: [],
      lineup: null,
      cash: gameData.season.startBudget,
      firstMatchday,
      transferBank: { matchday: firstMatchday, available: 2 },
    });
    expect(await storage.loadEmailIndex()).toEqual({
      "tom@example.org": doc.userId,
    });
    expect((await storage.loadLeague()).invites[0]).toMatchObject({
      usedBy: doc.userId,
      usedAt: NOW.toISOString(),
    });
    expect(await storage.loadManager(doc.userId)).toEqual(doc);
  });

  it("weist ungültige, fehlende und schon benutzte Codes ab", async () => {
    await seedInvites();
    await expect(
      registerManager(input({ inviteCode: "NOPE2345" }), NOW),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      registerManager(input({ inviteCode: undefined }), NOW),
    ).rejects.toMatchObject({ status: 400 });
    await registerManager(input(), NOW);
    await expect(
      registerManager(input({ email: "neu@example.org" }), NOW),
    ).rejects.toMatchObject({
      status: 400,
      message: "Der Einladungscode ist ungültig oder schon benutzt.",
    });
  });

  it("weist eine schon registrierte E-Mail mit 409 ab", async () => {
    await seedInvites("ABCD2345", "EFGH2345");
    await registerManager(input(), NOW);
    await expect(
      registerManager(input({ inviteCode: "EFGH2345" }), NOW),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("prüft Passwortlänge und E-Mail mit verständlicher Meldung", async () => {
    await seedInvites();
    await expect(
      registerManager(input({ password: "zu-kurz" }), NOW),
    ).rejects.toMatchObject({
      message: "Das Passwort braucht mindestens 10 Zeichen.",
    });
    await expect(
      registerManager(input({ email: "kein-at" }), NOW),
    ).rejects.toMatchObject({
      message: "Bitte gib eine gültige E-Mail-Adresse ein.",
    });
  });

  it("lässt Admins (ADMIN_EMAILS) ohne Einladungscode rein", async () => {
    const doc = await registerManager(
      input({ email: "alex@example.org", inviteCode: undefined }),
      NOW,
    );
    expect(doc.role).toBe("admin");
  });
});

describe("updateProfile: Anzeige- und Teamname ändern", () => {
  it("speichert beide Namen getrimmt, der Rest des Kontos bleibt", async () => {
    await seedInvites();
    const doc = await registerManager(input(), NOW);
    const updated = await updateProfile(doc.userId, {
      displayName: "  Tommy ",
      teamName: "Kreidelinie FC",
    });
    expect(updated).toMatchObject({
      displayName: "Tommy",
      teamName: "Kreidelinie FC",
    });
    const saved = await storage.loadManager(doc.userId);
    expect(saved).toMatchObject({
      displayName: "Tommy",
      teamName: "Kreidelinie FC",
      email: doc.email,
      passwordHash: doc.passwordHash,
      updatedAt: doc.updatedAt,
    });
  });

  it("weist leere und zu lange Namen mit verständlicher Meldung ab", async () => {
    await seedInvites();
    const doc = await registerManager(input(), NOW);
    await expect(
      updateProfile(doc.userId, { displayName: "   ", teamName: "X" }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Bitte gib einen Anzeigenamen ein.",
    });
    await expect(
      updateProfile(doc.userId, {
        displayName: "Tom",
        teamName: "x".repeat(41),
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Der Teamname darf höchstens 40 Zeichen haben.",
    });
  });

  it("antwortet ohne Konto mit 404", async () => {
    await expect(
      updateProfile("fehlt", { displayName: "A", teamName: "B" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("Anmeldung und Passwort-Reset (KONZEPT 8.3)", () => {
  it("meldet mit richtigem Passwort an, sonst nicht", async () => {
    await seedInvites();
    const doc = await registerManager(input(), NOW);
    expect(
      await authorizeCredentials({
        email: "TOM@example.org",
        password: "zehn-zeichen",
      }),
    ).toEqual({
      id: doc.userId,
      email: "tom@example.org",
      name: "Tom",
      role: "player",
    });
    expect(
      await authorizeCredentials({
        email: "tom@example.org",
        password: "falsch-falsch",
      }),
    ).toBeNull();
    expect(
      await authorizeCredentials({
        email: "wer@example.org",
        password: "zehn-zeichen",
      }),
    ).toBeNull();
    expect(await authorizeCredentials(null)).toBeNull();
  });

  it("setzt mit gültigem Reset-Code ein neues Passwort, einmalig", async () => {
    await seedInvites();
    const doc = await registerManager(input(), NOW);
    const league = await storage.loadLeague();
    await storage.saveLeague({
      ...league,
      resets: [
        { code: "RSET2345", userId: doc.userId, createdAt: NOW.toISOString() },
      ],
    });

    const later = new Date("2026-09-25T13:00:00Z");
    await resetPassword(
      { email: "tom@example.org", code: "rset2345", password: "ganz-neues-pw" },
      later,
    );
    expect(
      await authorizeCredentials({
        email: "tom@example.org",
        password: "ganz-neues-pw",
      }),
    ).not.toBeNull();
    expect(
      await authorizeCredentials({
        email: "tom@example.org",
        password: "zehn-zeichen",
      }),
    ).toBeNull();
    await expect(
      resetPassword(
        {
          email: "tom@example.org",
          code: "RSET2345",
          password: "noch-ein-pw1",
        },
        later,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("weist abgelaufene und fremde Reset-Anfragen mit derselben Meldung ab", async () => {
    await seedInvites();
    const doc = await registerManager(input(), NOW);
    await storage.saveLeague({
      invites: [],
      resets: [
        { code: "RSET2345", userId: doc.userId, createdAt: NOW.toISOString() },
      ],
    });
    const message =
      "E-Mail oder Reset-Code passen nicht. Codes gelten 24 Stunden und nur einmal.";
    const tooLate = new Date("2026-09-26T12:00:00Z");
    await expect(
      resetPassword(
        {
          email: "tom@example.org",
          code: "RSET2345",
          password: "ganz-neues-pw",
        },
        tooLate,
      ),
    ).rejects.toMatchObject({ message });
    await expect(
      resetPassword(
        {
          email: "wer@example.org",
          code: "RSET2345",
          password: "ganz-neues-pw",
        },
        NOW,
      ),
    ).rejects.toMatchObject({ message });
  });
});

describe("Storage", () => {
  it("wirft bei unlesbaren Daten, statt sie als leer zu behandeln", async () => {
    await writeFile(
      join(process.env.FM_LOCAL_DATA_DIR!, "league.json.enc"),
      "kaputt",
    );
    await expect(storage.loadLeague()).rejects.toThrow(
      "league.json.enc nicht lesbar",
    );
  });
});

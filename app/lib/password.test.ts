import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("Passwort-Hash (KONZEPT 8.3)", () => {
  it("speichert scrypt$N$r$p$salt$hash und prüft das richtige Passwort", async () => {
    const stored = await hashPassword("richtig-lang-1");
    expect(stored).toMatch(
      /^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{88}$/,
    );
    expect(await verifyPassword("richtig-lang-1", stored)).toBe(true);
    expect(await verifyPassword("falsch-lang-12", stored)).toBe(false);
  });

  it("salzt jeden Hash neu und lehnt kaputte Einträge ab", async () => {
    expect(await hashPassword("gleiches-pw-1")).not.toBe(
      await hashPassword("gleiches-pw-1"),
    );
    expect(await verifyPassword("x", "bcrypt$foo")).toBe(false);
  });
});

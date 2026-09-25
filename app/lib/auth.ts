// Übernommen aus Workgrid lib/auth.ts, angepasst: Google- und Passkey-Provider entfernt,
// ein Credentials-Provider mit E-Mail + Passwort (KONZEPT 8.3).
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "@/lib/auth.config";
import { verifyPassword } from "@/lib/password";
import { loadEmailIndex, loadManager } from "@/lib/storage";

const LoginInput = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

/** Prüft E-Mail + Passwort; null bei jedem Fehlschlag, ohne zu verraten, woran es lag. */
export async function authorizeCredentials(raw: unknown) {
  const parsed = LoginInput.safeParse(raw);
  if (!parsed.success) return null;
  const userId = (await loadEmailIndex())[parsed.data.email];
  if (!userId) return null;
  const doc = await loadManager(userId);
  if (!doc || !(await verifyPassword(parsed.data.password, doc.passwordHash)))
    return null;
  return {
    id: doc.userId,
    email: doc.email,
    name: doc.displayName,
    role: doc.role,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // Ein falsches Passwort ist kein Serverfehler; alles andere weiter loggen.
    error(error) {
      if (error.name !== "CredentialsSignin") console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      authorize: authorizeCredentials,
    }),
  ],
});

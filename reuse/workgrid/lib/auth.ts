import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { authConfig } from "@/lib/auth.config";
import { verifyPasskeyAuthentication } from "@/lib/passkey";
import { saveGoogleTokens } from "@/lib/storage";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

/**
 * Volle NextAuth.js v5 Konfiguration (Node-Runtime).
 *
 * - Google OAuth als primärer Login.
 * - Passkey (WebAuthn) als optionaler Login über einen Credentials-Provider.
 *   Die WebAuthn-Verifikation passiert in `lib/passkey.ts`.
 * - JWT-Sessions, 30 Tage gültig (siehe Spec 5.1).
 */
// Test-Login niemals in Produktion — auch wenn das Flag versehentlich gesetzt ist.
const devLoginEnabled =
  process.env.ENABLE_DEV_LOGIN === "true" &&
  process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: `openid email profile ${CALENDAR_SCOPE}`,
          access_type: "offline",
          // Kein prompt:"consent" — sonst erscheint der Zustimmungsdialog bei
          // JEDEM Login. Google liefert das refresh_token nur beim ersten
          // Einverständnis; wir speichern es und erhalten es danach (siehe
          // saveGoogleTokens-Merge).
          include_granted_scopes: "true",
        },
      },
    }),
    // Nur für Tests: Login ohne externen Provider. Über ENABLE_DEV_LOGIN
    // gesteuert und niemals in Produktion aktivieren.
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev Login",
            credentials: {},
            async authorize() {
              return {
                id: "dev-user",
                email: "dev@myworkgrid.local",
                name: "Test User",
                image: null,
              };
            },
          }),
        ]
      : []),
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        response: { label: "response", type: "text" },
      },
      async authorize(credentials) {
        if (
          !credentials?.response ||
          typeof credentials.response !== "string"
        ) {
          return null;
        }
        const challenge = (await cookies()).get("pk_auth_challenge")?.value;
        if (!challenge) return null;

        const authResponse = JSON.parse(credentials.response);
        const user = await verifyPasskeyAuthentication(authResponse, challenge);
        if (!user) return null;

        return {
          id: user.userId,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // jwt aus authConfig erweitern: Google-Tokens unter DERSELBEN ID (token.uid)
    // speichern, die die App zum Lesen nutzt (session.user.id).
    async jwt({ token, user, account }) {
      // STABILE User-ID festlegen. Ohne DB-Adapter würde Auth.js bei JEDEM
      // Google-Login eine neue zufällige user.id vergeben → die Daten lägen
      // jedes Mal unter einer anderen Identität und wären unauffindbar.
      // Die Google-Konto-ID (account.providerAccountId = sub) ist dagegen stabil.
      if (account?.provider === "google") {
        token.uid = account.providerAccountId
          ? `google-${account.providerAccountId}`
          : ((token.uid ?? user?.id) as string | undefined);
      } else if (user?.id && !token.uid) {
        // Passkey/Dev-Login: deren id ist bereits stabil.
        token.uid = user.id;
      }
      if (
        account?.provider === "google" &&
        typeof account.access_token === "string" &&
        token.uid
      ) {
        try {
          await saveGoogleTokens(token.uid as string, {
            accessToken: account.access_token,
            refreshToken:
              typeof account.refresh_token === "string"
                ? account.refresh_token
                : undefined,
            expiresAt:
              typeof account.expires_at === "number"
                ? account.expires_at
                : undefined,
            scope:
              typeof account.scope === "string" ? account.scope : undefined,
          });
        } catch (err) {
          console.error("saveGoogleTokens fehlgeschlagen:", err);
        }
      }
      return token;
    },
  },
});

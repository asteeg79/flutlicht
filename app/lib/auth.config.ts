// Übernommen aus Workgrid lib/auth.config.ts, angepasst: geschützte Pfade des
// Fußballmanagers, Rolle im Token für die Anzeige (geprüft wird serverseitig am Dokument).
import type { NextAuthConfig } from "next-auth";

export const PROTECTED_PREFIXES = [
  "/team",
  "/markt",
  "/spieltag",
  "/tabelle",
  "/spieler",
  "/einstellungen",
  "/admin",
];

/**
 * Edge-sichere Basiskonfiguration (keine Node-only Provider/Deps).
 * Wird sowohl von der Middleware als auch von der vollen Auth-Config genutzt.
 */
export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 Tage
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      return isProtected ? !!auth?.user : true;
    },
    async jwt({ token, user }) {
      // Stabile ID: die userId (UUID) aus dem Manager-Dokument (KONZEPT 12.3 Nr. 9).
      if (user?.id) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
        (session.user as { role?: unknown }).role = token.role;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

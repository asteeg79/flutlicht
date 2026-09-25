import type { NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = ["/board", "/notes", "/settings"];

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
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED_PREFIXES.some((p) =>
        pathname.startsWith(p),
      );
      if (isProtected) return isLoggedIn;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

// Auth.js (next-auth v5): email + password login against Customer, JWT session cookie.
// The token only carries the customer id; name, role etc. are read fresh from the database (src/lib/viewer.ts).
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";

const nextAuth = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const customer = await db.customer.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, passwordHash: true },
        });
        const ok = await verifyPassword(password, customer?.passwordHash ?? DUMMY_HASH);
        if (!customer?.passwordHash || !ok) return null;
        return { id: customer.id, name: customer.name, email: customer.email };
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      // When this login happened; sessions older than a password change are rejected (src/lib/viewer.ts).
      if (typeof token.iat === "number") session.issuedAt = token.iat;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    /** JWT issued-at, seconds since epoch */
    issuedAt?: number;
  }
}

export const { auth, signIn, signOut } = nextAuth;
export const { GET, POST } = nextAuth.handlers;

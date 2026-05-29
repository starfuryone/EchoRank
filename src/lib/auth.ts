import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "./rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // Registration stores email.toLowerCase().trim(); normalize the same
        // way here so a user who types "Jane@Example.com" can still log in.
        const loginEmail = String(credentials.email).toLowerCase().trim();
        const loginIp =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        // Note: when Redis is unavailable, rateLimit falls back to a
        // per-instance in-memory counter, so effective limits scale with the
        // number of running instances (N instances ≈ N× the limit). Acceptable
        // as a degraded fallback; Redis is the source of truth in production.
        const ipLimit = await rateLimit(`login-ip:${loginIp}`, 20, 300_000);
        const emailLimit = await rateLimit(`login-email:${loginEmail}`, 5, 300_000);
        if (!ipLimit.success || !emailLimit.success) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: loginEmail },
        });

        if (!user?.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { getClientIp } from "./client-ip";
import { rateLimit } from "./rate-limit";
import { logger } from "@/infrastructure/observability/logger";

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
        // Registration stores email.toLowerCase().trim(); normalize the same
        // way here so a user who types "Jane@Example.com" can still log in.
        const loginEmail = String(credentials?.email ?? "").toLowerCase().trim();
        const loginIp = getClientIp(request?.headers);

        // Auth.js collapses every `null` return into one opaque
        // CredentialsSignin error, which is right for the client but leaves
        // operators unable to tell a locked-out account from a typo'd
        // password. Record the deciding branch server-side only.
        // `xff` is the raw forwarded chain next to the resolved IP: when the
        // two disagree, the proxy chain is misattributing clients and the
        // per-IP limiter below is bucketing unrelated users together.
        const logCtx = {
          operation: "auth.credentials",
          email: loginEmail,
          ip: loginIp,
          xff: request?.headers?.get?.("x-forwarded-for") ?? null,
        };

        const reject = (reason: string) => {
          logger.warn({ ...logCtx, reason }, "Credentials login rejected");
          return null;
        };

        if (!credentials?.email || !credentials?.password) {
          return reject("missing_credentials");
        }

        // Note: when Redis is unavailable, rateLimit falls back to a
        // per-instance in-memory counter, so effective limits scale with the
        // number of running instances (N instances ≈ N× the limit). Acceptable
        // as a degraded fallback; Redis is the source of truth in production.
        const ipLimit = await rateLimit(`login-ip:${loginIp}`, 20, 300_000);
        const emailLimit = await rateLimit(`login-email:${loginEmail}`, 5, 300_000);
        if (!ipLimit.success) return reject("rate_limited_ip");
        if (!emailLimit.success) return reject("rate_limited_email");

        const user = await prisma.user.findUnique({
          where: { email: loginEmail },
        });

        if (!user) return reject("no_such_user");
        if (!user.passwordHash) return reject("no_password_hash");

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return reject("bad_password");

        logger.info(
          { ...logCtx, userId: user.id },
          "Credentials login succeeded"
        );

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

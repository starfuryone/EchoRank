import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { getClientIp } from "./client-ip";
import { rateLimit } from "./rate-limit";
import { logger } from "@/infrastructure/observability/logger";
import { loginEmailHash, recordLogin } from "./login-events";

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
        //
        // The record of each attempt (time, user, IP, outcome) is a
        // login_events row, kept 90 days (src/lib/login-events.ts). The
        // application log gets no email and no IP: pm2 logs rotate by size,
        // not age. `emailHash` correlates repeated attempts on one address;
        // `xffDiffers` keeps the old diagnostic (the forwarded chain
        // disagreeing with the resolved IP means the proxy chain is
        // misattributing clients and the per-IP limiter is bucketing
        // unrelated users together) without logging either address.
        const xffFirst = request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || null;
        const logCtx = {
          operation: "auth.credentials",
          emailHash: loginEmailHash(loginEmail),
          xffDiffers: xffFirst !== null && xffFirst !== loginIp,
        };

        const reject = async (reason: string, userId: string | null = null) => {
          logger.warn({ ...logCtx, reason }, "Credentials login rejected");
          await recordLogin({ userId, email: loginEmail, ip: loginIp, success: false, reason });
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
        if (!user.passwordHash) return reject("no_password_hash", user.id);

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return reject("bad_password", user.id);

        logger.info(
          { ...logCtx, userId: user.id },
          "Credentials login succeeded"
        );
        await recordLogin({ userId: user.id, email: loginEmail, ip: loginIp, success: true });

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

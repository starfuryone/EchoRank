// src/lib/site-crawler/login.ts
//
// Forms login at crawl time (Phase 4e). Once per crawl the worker asks the
// sidecar (POST /login) to log in; the cookie jar it returns lives in Redis
// for the crawl only — encrypted, with the crawl keys' TTL, deleted when the
// crawl ends — never in Postgres. The raw fetcher sends those cookies to the
// login host only; render mode hands the jar back to each /render. A failed
// login does not fail the crawl: it runs unauthenticated and says so.
// Credentials and cookies are never logged.

import "server-only";
import type { Redis } from "ioredis";
import { decryptToken, encryptToken } from "@/lib/gsc/crypto";
import { CRAWLER_USER_AGENT, REDIS_KEY_TTL_SECONDS } from "./constants";
import { LOGIN_REASONS, type LoginReason, type RuntimeLogin, type StoredLogin } from "./login-config";
export { openLogin, sealLogin } from "./crawl-config-secrets";

const SIDECAR = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";
/** The sidecar's 30 s login plus up to 25 s waiting for the render slot. */
const LOGIN_REQUEST_TIMEOUT_MS = 60_000;

export interface JarCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
}

export type LoginOutcome = { ok: true; cookies: JarCookie[] } | { ok: false; reason: LoginReason };

export const loginJarKey = (jobId: string) => `crawl:${jobId}:login`;

/** Read a stored login back from JSON; null when it is not one. */
export function readStoredLogin(raw: unknown): StoredLogin | null {
  const r = raw as Partial<StoredLogin> | null;
  return r && typeof r === "object" && typeof r.loginUrl === "string" && r.username && r.password ? (r as StoredLogin) : null;
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** One login through the sidecar. Never throws; never logs the request. */
export async function sidecarLogin(login: RuntimeLogin, userAgent: string = CRAWLER_USER_AGENT, fetchImpl: FetchLike = fetch): Promise<LoginOutcome> {
  try {
    const res = await fetchImpl(`${SIDECAR()}/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "" },
      body: JSON.stringify({ ...login, userAgent }),
      signal: AbortSignal.timeout(LOGIN_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: res.status === 400 ? "login_page_unreachable" : "sidecar_unavailable" };
    const d = (await res.json()) as { ok?: boolean; cookies?: JarCookie[]; reason?: string };
    if (d.ok && Array.isArray(d.cookies)) return { ok: true, cookies: d.cookies };
    const reason = (LOGIN_REASONS as readonly string[]).includes(d.reason ?? "") ? (d.reason as LoginReason) : "success_check_failed";
    return { ok: false, reason };
  } catch {
    return { ok: false, reason: "sidecar_unavailable" };
  }
}

export async function saveJar(redis: Pick<Redis, "set">, jobId: string, jar: JarCookie[], secret?: string): Promise<void> {
  await redis.set(loginJarKey(jobId), encryptToken(JSON.stringify(jar), secret), "EX", REDIS_KEY_TTL_SECONDS);
}

export async function loadJar(redis: Pick<Redis, "get">, jobId: string, secret?: string): Promise<JarCookie[] | null> {
  const raw = await redis.get(loginJarKey(jobId));
  if (!raw) return null;
  try {
    return JSON.parse(decryptToken(raw, secret)) as JarCookie[];
  } catch {
    return null;
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/**
 * The Cookie header the jar gives this URL: only the login host (and its
 * subdomains for a domain cookie), path-matched, Secure cookies over https only.
 */
export function cookieHeaderFor(jar: readonly JarCookie[], loginHost: string, url: string): string | null {
  const u = hostOf(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (host !== loginHost) return null;
  const pairs = jar
    .filter((c) => {
      const d = (c.domain || host).toLowerCase().replace(/^\./, "");
      return (host === d || host.endsWith(`.${d}`)) && u.pathname.startsWith(c.path || "/") && (!c.secure || u.protocol === "https:");
    })
    .map((c) => `${c.name}=${c.value}`);
  return pairs.length ? pairs.join("; ") : null;
}

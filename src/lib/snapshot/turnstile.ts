// src/lib/snapshot/turnstile.ts — Cloudflare Turnstile server-side check.
//
// Required on every new check. No TURNSTILE_SECRET_KEY means no check at all:
// the form would otherwise be an open door to two paid APIs. For local and
// e2e runs use Cloudflare's published test keys (always-pass:
// 1x0000000000000000000000000000000AA / site key 1x00000000000000000000AA).
import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileOutcome = "ok" | "failed" | "unconfigured";

export async function verifyTurnstile(token: string | undefined, ip: string): Promise<TurnstileOutcome> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return "unconfigured";
  if (!token || token.length > 2048) return "failed";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(process.env.TURNSTILE_VERIFY_URL ?? VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

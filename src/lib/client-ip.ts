/**
 * Resolve the originating client IP for a request.
 *
 * The origin sits behind Cloudflare → Caddy. Header precedence matters:
 *
 *  1. `cf-connecting-ip` — Cloudflare *overwrites* this on every proxied
 *     request, so it cannot be spoofed by the client.
 *  2. `x-real-ip` — set by Caddy from `{client_ip}` (which is only meaningful
 *     when Caddy's `trusted_proxies` lists the Cloudflare ranges).
 *  3. `x-forwarded-for` — last resort. Cloudflare *appends* to a client-supplied
 *     XFF, so its first element is attacker-controlled; and when Caddy does not
 *     trust its upstream it replaces the header with the immediate peer, which
 *     collapses every visitor onto the handful of Cloudflare edge IPs. Either
 *     failure mode breaks per-IP rate limiting, hence the low precedence.
 *
 * Returns `"unknown"` when no header is usable, which callers bucket together.
 */
export function getClientIp(headers: Headers | undefined | null): string {
  const pick = (name: string): string | undefined => {
    const raw = headers?.get?.(name);
    const value = raw?.split(",")[0]?.trim();
    return value ? value : undefined;
  };

  return (
    pick("cf-connecting-ip") ??
    pick("x-real-ip") ??
    pick("x-forwarded-for") ??
    "unknown"
  );
}

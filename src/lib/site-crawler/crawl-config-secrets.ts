// src/lib/site-crawler/crawl-config-secrets.ts
//
// Sealing and opening the secret fields of a CrawlConfig: custom header
// values, the cookie string, the basic-auth password. AES-256-GCM with the
// GSC_TOKEN_ENCRYPTION_KEY pattern (src/lib/gsc/crypto.ts), so one key covers
// every secret at rest. Values are never logged, never written to CSV, and
// never returned to the UI (crawl-config.ts viewCrawlConfig).

import "server-only";
import { decryptToken, encryptToken } from "@/lib/gsc/crypto";
import type {
  CrawlConfigInput,
  RuntimeCrawlConfig,
  SecretInput,
  StoredCrawlConfig,
  StoredSecret,
} from "./crawl-config";

export class MissingKeptSecretError extends Error {
  constructor(readonly field: string) {
    super(`No saved value to keep for ${field}`);
  }
}

/**
 * Encrypt an input config for storage. `{ keep: true }` takes the matching
 * value from `previous` (the site's saved defaults); with nothing to keep it
 * throws MissingKeptSecretError, which the route turns into a 400.
 */
export function sealCrawlConfig(
  input: CrawlConfigInput,
  previous: StoredCrawlConfig | null,
  secret?: string,
): StoredCrawlConfig {
  const seal = (v: SecretInput, kept: StoredSecret | null | undefined, field: string): StoredSecret | null => {
    if (v === null) return null;
    if (typeof v === "string") return v === "" ? null : { enc: encryptToken(v, secret) };
    if (!kept) throw new MissingKeptSecretError(field);
    return kept;
  };
  const headers = input.headers.flatMap((h) => {
    const kept = previous?.headers.find((p) => p.name.toLowerCase() === h.name.toLowerCase())?.value;
    const value = seal(h.value, kept, `headers.${h.name}`);
    return value ? [{ name: h.name, value }] : [];
  });
  const password = input.basicAuth ? seal(input.basicAuth.password, previous?.basicAuth?.password, "basicAuth.password") : null;
  return {
    ...input,
    headers,
    cookies: seal(input.cookies, previous?.cookies, "cookies"),
    basicAuth: input.basicAuth && password ? { user: input.basicAuth.user, password } : null,
  };
}

/** Decrypt for the worker. The result lives in memory for the length of the crawl. */
export function openCrawlConfig(stored: StoredCrawlConfig, secret?: string): RuntimeCrawlConfig {
  const open = (s: StoredSecret) => decryptToken(s.enc, secret);
  return {
    ...stored,
    headers: stored.headers.map((h) => ({ name: h.name, value: open(h.value) })),
    cookies: stored.cookies ? open(stored.cookies) : null,
    basicAuth: stored.basicAuth ? { user: stored.basicAuth.user, password: open(stored.basicAuth.password) } : null,
  };
}

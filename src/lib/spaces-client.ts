// src/lib/spaces-client.ts
//
// The DigitalOcean Spaces credentials and the S3 client, shared by everything
// that talks to Spaces.
//
// ── WHAT IS SHARED AND WHAT DELIBERATELY IS NOT ────────────────────────────
// Shared: reading the credentials, and the memoized S3Client. One client means
// one connection pool, and one place a rotated key takes effect.
//
// NOT shared: the BUCKET and the FAILURE DOCTRINE, because the two callers want
// opposite things and merging them would give one of them the wrong behaviour:
//
//   historical/spaces.ts  stores snapshot bodies. Missing config MUST throw —
//                         a snapshot silently not written is data loss, and a
//                         silent fallback to a default bucket is the failure
//                         that module exists to prevent.
//   spaces-cache.ts       stores cached provider payloads. Missing config must
//                         NEVER throw — a cache that cannot be reached is a
//                         cache miss, and a miss is only ever slower and
//                         costlier, never wrong.
//
// So this module reads credentials and hands back a client; each caller names
// its own bucket and decides what a failure means.
//
// ── READ AT CALL TIME, NEVER AT MODULE LOAD ────────────────────────────────
// Module-level capture freezes whatever was in the environment when the module
// first warmed — the trap that kept av-service serving a rotated key across a
// `pm2 restart`.

import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

export class SpacesNotConfiguredError extends Error {
  readonly statusCode = 503;
  constructor(readonly missing: string[]) {
    super(`Spaces storage is not configured (missing: ${missing.join(", ")}).`);
    this.name = "SpacesNotConfiguredError";
  }
}

/** Credentials and endpoint. The bucket is the caller's business. */
export interface SpacesCredentials {
  key: string;
  secret: string;
  region: string;
  endpoint: string;
}

/** Throws SpacesNotConfiguredError naming exactly what is missing. */
export function spacesCredentials(): SpacesCredentials {
  const key = process.env.SPACES_KEY?.trim();
  const secret = process.env.SPACES_SECRET?.trim();
  const region = process.env.SPACES_REGION?.trim();

  const missing = [
    !key && "SPACES_KEY",
    !secret && "SPACES_SECRET",
    !region && "SPACES_REGION",
  ].filter(Boolean) as string[];
  if (missing.length) throw new SpacesNotConfiguredError(missing);

  return {
    key: key!,
    secret: secret!,
    region: region!,
    endpoint:
      process.env.SPACES_ENDPOINT?.trim() || `https://${region}.digitaloceanspaces.com`,
  };
}

let cached: { client: S3Client; endpoint: string; key: string } | null = null;

/**
 * The memoized client.
 *
 * Keyed on endpoint+key so a credential rotation builds a NEW client rather
 * than reusing one that signs with the dead secret.
 */
export function spacesClient(credentials: SpacesCredentials): S3Client {
  if (cached && cached.endpoint === credentials.endpoint && cached.key === credentials.key) {
    return cached.client;
  }
  const next = new S3Client({
    region: credentials.region,
    endpoint: credentials.endpoint,
    credentials: { accessKeyId: credentials.key, secretAccessKey: credentials.secret },
  });
  cached = { client: next, endpoint: credentials.endpoint, key: credentials.key };
  return next;
}

/** Reset the memoized client. Tests only. */
export function resetSpacesClient(): void {
  cached = null;
}

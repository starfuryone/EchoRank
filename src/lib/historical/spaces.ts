// src/lib/historical/spaces.ts
//
// Snapshot bodies live in DigitalOcean Spaces, not Postgres.
//
// AiLensAnalysis already declines to persist its markdown — "hundreds of KB per
// row... would make the table the largest in the database within a month". That
// reasoning does not go away because a new feature wants the bytes; it just
// moves the bytes somewhere built for them. PageSnapshot keeps metadata, this
// module keeps the content.
//
// PRIVATE, ALWAYS. Every put sets ACL private and the UI never sees a bucket
// URL — bodies are streamed back through an authenticated route that re-checks
// the tenant owns the row. A snapshot is a copy of a page a tenant chose to
// archive; some of those are staging URLs and internal pages.
//
// NO SILENT FALLBACK. Missing configuration throws. The alternative — writing
// to a default bucket, or quietly degrading to public-read — is the failure
// mode this module exists to prevent.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

export class SpacesNotConfiguredError extends Error {
  readonly statusCode = 503;
  constructor(missing: string[]) {
    super(`Snapshot storage is not configured (missing: ${missing.join(", ")}).`);
    this.name = "SpacesNotConfiguredError";
  }
}

export class SpacesUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Snapshot storage is temporarily unavailable.");
    this.name = "SpacesUnavailableError";
  }
}

export interface SpacesConfig {
  key: string;
  secret: string;
  region: string;
  bucket: string;
  endpoint: string;
}

/**
 * Read config at CALL time, never at module load.
 *
 * Module-level capture freezes whatever was in the environment when the module
 * first warmed — the trap that kept av-service serving a rotated key across a
 * `pm2 restart`.
 */
export function spacesConfig(): SpacesConfig {
  const key = process.env.SPACES_KEY?.trim();
  const secret = process.env.SPACES_SECRET?.trim();
  const region = process.env.SPACES_REGION?.trim();
  const bucket = process.env.SPACES_BUCKET?.trim();

  const missing = [
    !key && "SPACES_KEY",
    !secret && "SPACES_SECRET",
    !region && "SPACES_REGION",
    !bucket && "SPACES_BUCKET",
  ].filter(Boolean) as string[];
  if (missing.length) throw new SpacesNotConfiguredError(missing);

  return {
    key: key!,
    secret: secret!,
    region: region!,
    bucket: bucket!,
    endpoint: process.env.SPACES_ENDPOINT?.trim() || `https://${region}.digitaloceanspaces.com`,
  };
}

/** True when all four vars are present — lets a page hide capture UI rather
 *  than offering a button that can only fail. */
export function isSpacesConfigured(): boolean {
  try {
    spacesConfig();
    return true;
  } catch {
    return false;
  }
}

let cached: { client: S3Client; endpoint: string; key: string } | null = null;

function client(config: SpacesConfig): S3Client {
  // Keyed on endpoint+key so a credential rotation builds a new client rather
  // than reusing one signing with the dead secret.
  if (cached && cached.endpoint === config.endpoint && cached.key === config.key) {
    return cached.client;
  }
  const next = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.key, secretAccessKey: config.secret },
  });
  cached = { client: next, endpoint: config.endpoint, key: config.key };
  return next;
}

/** Reset the memoized client. Tests only. */
export function resetSpacesClient(): void {
  cached = null;
}

/**
 * `snapshots/<tenantId>/<sha256>.md.gz`
 *
 * Content-addressed: identical markdown captured twice is one object. The
 * tenant prefix keeps one tenant's objects listable without exposing another's,
 * and means a tenant deletion is a prefix delete.
 */
export function snapshotObjectKey(tenantId: string, contentHash: string): string {
  return `snapshots/${tenantId}/${contentHash}.md.gz`;
}

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient failures; surface configuration errors immediately. */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (err) {
      last = err;
      if (err instanceof SpacesNotConfiguredError) throw err;
      if (attempt < MAX_ATTEMPTS) await sleep(200 * attempt);
    }
  }
  // The underlying error is logged by name only — an S3 error can carry the
  // signed request, and that carries the key id.
  console.error("[spaces] operation failed after retries:", last instanceof Error ? last.name : typeof last);
  throw new SpacesUnavailableError();
}

export async function putSnapshotObject(key: string, gzipped: Buffer): Promise<void> {
  const config = spacesConfig();
  await withRetry(() =>
    client(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: gzipped,
        // Never public-read. Asserted by tests/historical-spaces.test.ts.
        ACL: "private",
        ContentType: "application/gzip",
      }),
    ),
  );
}

export async function getSnapshotObject(key: string): Promise<Buffer> {
  const config = spacesConfig();
  return withRetry(async () => {
    const res = await client(config).send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    if (!res.Body) throw new Error("empty body");
    return Buffer.from(await res.Body.transformToByteArray());
  });
}

export async function deleteSnapshotObject(key: string): Promise<void> {
  const config = spacesConfig();
  await withRetry(() =>
    client(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key })),
  );
}

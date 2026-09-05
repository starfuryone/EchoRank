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
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  SpacesNotConfiguredError,
  spacesClient,
  spacesCredentials,
  resetSpacesClient,
} from "@/lib/spaces-client";

// Re-exported so existing importers of these names keep working. The client
// and the credential reader moved to @/lib/spaces-client when the backlinks
// cache needed them too; the BUCKET and the throw-on-missing doctrine stayed
// here, because that cache wants the opposite failure behaviour. See that
// module's header.
export { SpacesNotConfiguredError, resetSpacesClient };

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
  const bucket = process.env.SPACES_BUCKET?.trim();
  // The bucket is checked FIRST and separately, so a deployment missing only
  // SPACES_BUCKET is told exactly that rather than nothing — spacesCredentials
  // does not know this module wants one.
  if (!bucket) throw new SpacesNotConfiguredError(["SPACES_BUCKET"]);
  const credentials = spacesCredentials();
  return { ...credentials, bucket };
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

/** The shared, memoized client. See @/lib/spaces-client. */
function client(config: SpacesConfig) {
  return spacesClient(config);
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

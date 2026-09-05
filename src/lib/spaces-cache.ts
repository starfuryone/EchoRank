// src/lib/spaces-cache.ts
//
// A shared, cross-tenant cache for expensive provider payloads, in DigitalOcean
// Spaces.
//
// ── FAIL-OPEN, IN BOTH DIRECTIONS. THIS IS THE WHOLE DESIGN. ───────────────
// Nothing here ever throws. A read that fails is a MISS, and a miss is only
// slower and costlier — never wrong. A write that fails is logged and dropped,
// because the caller already has the data it was about to cache and the
// customer is already waiting on it.
//
// This is the exact opposite of src/lib/historical/spaces.ts, which must throw
// on missing configuration because a snapshot silently not written is data
// loss. Both are right; they store different things. The two share credentials
// and one S3Client through @/lib/spaces-client and nothing else, which is why
// that module exists.
//
// The practical consequence: on a deployment where SPACES_CACHE_BUCKET is
// unset, every lookup simply behaves as it did before this cache existed. That
// is what lets the backlinks work ship before anyone has provisioned the
// bucket.
//
// ── SHARED ACROSS TENANTS, ON PURPOSE ──────────────────────────────────────
// The key carries no tenant id. A domain's backlink profile is a fact about the
// public web, not about the customer who asked — the same doctrine the audit
// domain cache already follows. Two workspaces asking about example.com on the
// same day get one provider call between them.
//
// THE METERING IS STILL STRICTLY PER-TENANT, and that separation is the thing
// to keep straight: the payload is shared, the ALLOWANCE is not. A cache hit
// consumes nothing from anyone (the Keyword Opportunity Finder's rule), and a
// miss bills only the tenant whose request paid for it.
//
// The corollary is a rule about what may go in here: only data that is a fact
// about a public target. Anything derived from one tenant's own configuration,
// history or private input must not be cached under a tenant-free key.
//
// ── STORAGE CLASS ──────────────────────────────────────────────────────────
// Default/Standard, never a cold or archival class. Those carry a 30-day
// minimum retention and a 128 KiB minimum billable object size, both of which
// are a straight loss on small objects that expire in a week.
//
// ── OPERATOR: LIFECYCLE ────────────────────────────────────────────────────
// Recommended rule on the cache bucket: expire objects under the `cache/`
// prefix after 30 days. PREFIX-FILTERED, so that if the cache bucket is ever
// shared with anything else, a backup does not silently expire alongside a
// cache entry. Every key this module writes begins `cache/`, enforced below.

import "server-only";

import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { spacesClient, spacesCredentials } from "@/lib/spaces-client";

/** Every object this module touches lives under here. See the lifecycle note. */
export const CACHE_PREFIX = "cache";

/**
 * Short. A cache that takes longer than the call it is avoiding is not a
 * cache — three seconds is already generous for a single small GET, and the
 * fallback is simply to do the work.
 */
const TIMEOUT_MS = 3_000;

/** Above this, something is being cached that should not be. */
const MAX_OBJECT_BYTES = 8 * 1024 * 1024;

export function isSpacesCacheConfigured(): boolean {
  try {
    cacheConfig();
    return true;
  } catch {
    return false;
  }
}

interface CacheConfig {
  bucket: string;
  credentials: ReturnType<typeof spacesCredentials>;
}

/**
 * Read at CALL time, never at module load — a rotated key must take effect
 * without a restart. Throws only internally; every exported function catches.
 */
function cacheConfig(): CacheConfig {
  const bucket = process.env.SPACES_CACHE_BUCKET?.trim();
  if (!bucket) throw new Error("SPACES_CACHE_BUCKET is not set");
  return { bucket, credentials: spacesCredentials() };
}

/**
 * The key for one cached payload.
 *
 * `cache/<feature>/<version>/<scope>/<sha256(target)>/<dateBucket>.json.gz`
 *
 * THE TARGET IS HASHED, not embedded. A target can be an arbitrary URL — with
 * slashes, spaces, percent-encoding and non-ASCII — and putting it in a key
 * raw would produce accidental directory structure, unlistable prefixes, and
 * two spellings of one target in two objects. A hash is fixed-width and
 * collision-free for this purpose.
 *
 * THE VERSION SEGMENT IS AN ESCAPE HATCH. When the shape a caller stores
 * changes, bumping `version` orphans the old objects rather than deserialising
 * them into the new shape — and the lifecycle rule collects them. Never reuse
 * a version for a changed shape; that is a cache poisoned with a payload the
 * reader will misread.
 *
 * THE DATE BUCKET IS IN THE KEY, so freshness needs no timestamp comparison and
 * no expiry logic: a stale object is simply a key nobody asks for.
 */
export function cacheKey(input: {
  feature: string;
  version: string;
  scope: string;
  target: string;
  dateBucket: string;
}): string {
  const digest = createHash("sha256").update(input.target.trim().toLowerCase()).digest("hex");
  return `${CACHE_PREFIX}/${input.feature}/${input.version}/${input.scope}/${digest}/${input.dateBucket}.json.gz`;
}

/**
 * A UTC date bucket `days` wide, anchored to the epoch.
 *
 * ANCHORED, not rolling: every caller asking on the same day gets the same
 * bucket, which is what makes the cache shared rather than per-caller. A
 * 7-day bucket therefore rolls on a fixed schedule for everyone, and a lookup
 * near the boundary is a miss for everyone at once — deliberate, and much
 * easier to reason about than N staggered windows.
 */
export function dateBucket(days: number, now: Date = new Date()): string {
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  return `d${Math.floor(dayIndex / days) * days}`;
}

function timeout(): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS);
}

/**
 * Read a cached payload, or null.
 *
 * NULL FOR EVERY FAILURE — not configured, not found, timed out, malformed
 * JSON, corrupt gzip. The caller's only correct response to any of them is the
 * same: do the work. Distinguishing them here would tempt a caller to branch
 * on a difference that does not change what it should do.
 */
export async function readCache<T>(key: string): Promise<T | null> {
  let config: CacheConfig;
  try {
    config = cacheConfig();
  } catch {
    // Not configured is a miss, silently. This is the normal state on a
    // deployment that has not provisioned the bucket, and logging it per
    // request would fill the log with a fact that does not change.
    return null;
  }

  try {
    const response = await spacesClient(config.credentials).send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { abortSignal: timeout() },
    );
    if (!response.Body) return null;
    const gz = Buffer.from(await response.Body.transformToByteArray());
    return JSON.parse(gunzipSync(gz).toString("utf8")) as T;
  } catch (err) {
    // A genuine miss (NoSuchKey) is the common case and not worth a log line.
    const name = err instanceof Error ? err.name : String(err);
    if (name !== "NoSuchKey" && name !== "NotFound") {
      // Name only. An S3 error can carry the signed request, and that carries
      // the key id.
      console.error(`[spaces-cache] read failed for ${key}: ${name}`);
    }
    return null;
  }
}

/**
 * Store a payload. Returns whether it landed; callers may ignore that.
 *
 * NEVER THROWS. By the time this runs the customer has their answer and the
 * provider has been paid — failing the request now would turn a successful,
 * billed lookup into an error, which is the worst possible trade for a cache.
 */
export async function writeCache(key: string, value: unknown): Promise<boolean> {
  if (!key.startsWith(`${CACHE_PREFIX}/`)) {
    // The lifecycle rule is prefix-filtered, so an object written outside the
    // prefix would never expire. Refused rather than written.
    console.error(`[spaces-cache] refusing to write outside ${CACHE_PREFIX}/: ${key}`);
    return false;
  }

  let config: CacheConfig;
  try {
    config = cacheConfig();
  } catch {
    return false;
  }

  try {
    const gz = gzipSync(Buffer.from(JSON.stringify(value), "utf8"));
    if (gz.byteLength > MAX_OBJECT_BYTES) {
      console.error(
        `[spaces-cache] refusing to write ${key}: ${gz.byteLength} bytes exceeds the cap`,
      );
      return false;
    }

    await spacesClient(config.credentials).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: gz,
        // Private, always. The app reads through signed SDK calls; no public
        // bucket URL ever reaches a browser.
        ACL: "private",
        ContentType: "application/json",
        ContentEncoding: "gzip",
        // No StorageClass: the default/Standard class. See the header.
      }),
      { abortSignal: timeout() },
    );
    return true;
  } catch (err) {
    console.error(
      `[spaces-cache] write failed for ${key}: ${err instanceof Error ? err.name : String(err)}`,
    );
    return false;
  }
}

/** Test seam: the gzip round-trip, without touching the network. */
export const __testing = {
  encode: (value: unknown) => gzipSync(Buffer.from(JSON.stringify(value), "utf8")),
  decode: <T>(gz: Buffer): T => JSON.parse(gunzipSync(gz).toString("utf8")) as T,
  MAX_OBJECT_BYTES,
  TIMEOUT_MS,
};

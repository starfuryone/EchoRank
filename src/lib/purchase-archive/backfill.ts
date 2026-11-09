// src/lib/purchase-archive/backfill.ts — the one-time backfill
// (ECHORANK-DATA-ARCHIVE.md Phase 3): what is already cached goes into the
// archive with purpose "backfill".
//
// WHAT EXISTS TO BACKFILL. Phase 0 found:
//   - echorank-seodata holds nothing yet (the seo-gateway never wrote to it);
//   - SeoApiCall stores no payloads (path, cost, task id only);
//   - the shared provider cache (SPACES_CACHE_BUCKET, src/lib/spaces-cache.ts)
//     holds DataForSEO-derived payloads, 7-day buckets: cache/<feature>/
//     <version>/<scope>/<sha256(target)>/<dateBucket>.json.gz.
// So the backfill reads that cache. Its objects are the tools' assembled
// payloads, not raw envelopes, and the target is only a hash; each becomes one
// archive object under endpoint "cache-<feature>-<version>-<scope>", with the
// key parts as its request and the object's LastModified as receivedAt — so a
// second run is idempotent (same request hash, same instant → same dedupeKey).
//
// DRY RUN BY DEFAULT: list, count and size first; write only with run: true.
// Google Places is never in this cache; nothing excluded can be backfilled.

import "server-only";

import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { Readable } from "node:stream";
import { prepareObject } from "./core";
import { ARCHIVE_APP, PROVIDERS, liveSecrets } from "./config";
import { storeObject, type ArchiveIndex } from "./writer";
import type { ListedObject, ObjectStore } from "@/lib/spaces/client";

const gunzipAsync = promisify(gunzip);

/** Cache features whose payloads may name people (SERP snippets). */
export const PERSONAL_CACHE_FEATURES: ReadonlySet<string> = new Set(["reddit-threads", "serp", "serp-volatility"]);

export interface CacheKeyParts {
  feature: string;
  version: string;
  scope: string;
  targetSha256: string;
  dateBucket: string;
}

/** cache/<feature>/<version>/<scope>/<sha256>/<bucket>.json.gz → parts, or null. */
export function parseCacheKey(key: string): CacheKeyParts | null {
  const m = /^cache\/([^/]+)\/([^/]+)\/([^/]+)\/([0-9a-f]{64})\/([^/]+)\.json\.gz$/.exec(key);
  if (!m) return null;
  return { feature: m[1]!, version: m[2]!, scope: m[3]!, targetSha256: m[4]!, dateBucket: m[5]! };
}

export interface BackfillPlan {
  objects: number;
  bytes: number;
  byFeature: Record<string, { objects: number; bytes: number }>;
  skipped: number;
}

export interface BackfillResult extends BackfillPlan {
  dryRun: boolean;
  stored: number;
  duplicates: number;
  failed: number;
}

async function toBuffer(s: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of s) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

export async function runBackfill(deps: {
  cache: ObjectStore;
  archive: ObjectStore | null;
  index: ArchiveIndex | null;
  run?: boolean;
  limit?: number;
  log?: (line: string) => void;
}): Promise<BackfillResult> {
  const plan: BackfillPlan = { objects: 0, bytes: 0, byFeature: {}, skipped: 0 };
  const listed: Array<{ o: ListedObject; parts: CacheKeyParts }> = [];
  for await (const o of deps.cache.list("cache/")) {
    const parts = parseCacheKey(o.key);
    if (!parts) {
      plan.skipped++;
      continue;
    }
    plan.objects++;
    plan.bytes += o.size;
    const f = (plan.byFeature[parts.feature] ??= { objects: 0, bytes: 0 });
    f.objects++;
    f.bytes += o.size;
    if (deps.run && (deps.limit === undefined || listed.length < deps.limit)) listed.push({ o, parts });
  }
  const result: BackfillResult = { ...plan, dryRun: !deps.run, stored: 0, duplicates: 0, failed: 0 };
  if (!deps.run) return result;
  if (!deps.archive || !deps.index) throw new Error("PURCHASE_ARCHIVE_* is not configured: nothing to write to.");

  const secrets = liveSecrets();
  for (const { o, parts } of listed) {
    try {
      const payload = JSON.parse((await gunzipAsync(await toBuffer(await deps.cache.get(o.key)))).toString("utf8")) as unknown;
      const obj = await prepareObject(
        ARCHIVE_APP,
        {
          provider: PROVIDERS.dataforseo,
          endpoint: `cache/${parts.feature}/${parts.version}/${parts.scope}`,
          request: { cache_feature: parts.feature, cache_version: parts.version, cache_scope: parts.scope, target_sha256: parts.targetSha256, date_bucket: parts.dateBucket },
          response: payload,
          costUsd: null,
          providerTaskId: null,
          tenantId: null,
          purpose: "backfill",
        },
        { personalData: PERSONAL_CACHE_FEATURES.has(parts.feature), receivedAt: o.lastModified ?? new Date(0), secrets },
      );
      const out = await storeObject(obj, { store: deps.archive, index: deps.index });
      if (out === "stored") result.stored++;
      else result.duplicates++;
    } catch (err) {
      result.failed++;
      deps.log?.(`failed ${o.key}: ${(err as Error)?.message ?? err}`);
    }
  }
  return result;
}

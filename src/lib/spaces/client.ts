// src/lib/spaces/client.ts
//
// The crawl archive's object store: a PRIVATE DigitalOcean Spaces bucket, on
// its own access key (SPACES_ARCHIVE_*), separate from src/lib/spaces-client.ts
// (SPACES_KEY: snapshots and the provider cache). A key limited to this one
// bucket means a leak of it exposes crawl archives and exports, nothing else.
//
// ── NOT CONFIGURED IS NOT AN ERROR ─────────────────────────────────────────
// Missing any of the five variables → spacesConfigured() is false and
// archiveStore() is null. Every caller falls back to what it did before this
// module existed: the archive sweep does nothing, exports stream through Next.
//
// ── THE CLIENT SETTINGS, AND WHY ────────────────────────────────────────────
//   forcePathStyle: false   virtual-hosted URLs (<bucket>.<region>.digitaloceanspaces.com),
//                           what Spaces documents.
//   maxAttempts: 5          Spaces answers 503 SlowDown under load; the SDK's
//                           standard retry backs off between attempts.
//   *Checksum*: WHEN_REQUIRED
//                           SDK v3 ≥ 3.729 adds CRC32 checksums to every upload
//                           by default; S3-compatible stores can reject them.
//   Content-MD5 on DeleteObjects
//                           The one call where a checksum IS required. The SDK
//                           would send CRC32 there even on WHEN_REQUIRED; the
//                           middleware below sends the MD5 S3 originally asked
//                           for instead, which every S3-compatible store accepts.
//
// ── PRESIGNED URLS ─────────────────────────────────────────────────────────
// Against the bucket endpoint, never the Spaces CDN (CDN presigned uploads are
// capped near 7.9 MiB, and Cloudflare already fronts the site). The bucket
// stays private: nothing here ever sets an ACL.
//
// ── KEYS ───────────────────────────────────────────────────────────────────
// tenants/<tenantId>/crawls/<crawlId>/…   the archive (manifest + one object per table)
// tenants/<tenantId>/exports/<crawlId>/…  generated downloads
// Every id is checked against a strict charset before it becomes a path, and
// every route derives tenantId from the session, never from input.
//
// Read at call time, never at module load (spaces-client.ts explains the trap).

import "server-only";

import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type S3ClientConfig,
  type ServiceInputTypes,
  type ServiceOutputTypes,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FinalizeRequestMiddleware } from "@smithy/types";

export const ARCHIVE_ENV = [
  "SPACES_ARCHIVE_ENDPOINT",
  "SPACES_ARCHIVE_REGION",
  "SPACES_ARCHIVE_BUCKET",
  "SPACES_ARCHIVE_KEY",
  "SPACES_ARCHIVE_SECRET",
] as const;

export interface ArchiveConfig {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  secret: string;
}

/** The five variables, or null when any is missing. Never logged. */
export function archiveConfig(env: NodeJS.ProcessEnv = process.env): ArchiveConfig | null {
  const [endpoint, region, bucket, key, secret] = ARCHIVE_ENV.map((n) => env[n]?.trim() ?? "");
  if (!endpoint || !region || !bucket || !key || !secret) return null;
  return { endpoint, region, bucket, key, secret };
}

export function spacesConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (override !== undefined) return override !== null;
  return archiveConfig(env) !== null;
}

/** DeleteObjects needs a body checksum; send Content-MD5 rather than the SDK's CRC32. */
function contentMd5ForDelete(client: S3Client): void {
  const mw: FinalizeRequestMiddleware<ServiceInputTypes, ServiceOutputTypes> = (next, context) => async (args) => {
    const req = args.request as { headers?: Record<string, string>; body?: unknown };
    if (context.commandName === "DeleteObjectsCommand" && req.headers && typeof req.body === "string") {
      for (const h of Object.keys(req.headers)) {
        if (h.toLowerCase().startsWith("x-amz-checksum-") || h.toLowerCase() === "x-amz-sdk-checksum-algorithm") delete req.headers[h];
      }
      req.headers["content-md5"] = createHash("md5").update(req.body).digest("base64");
    }
    return next(args);
  };
  client.middlewareStack.addRelativeTo(mw, { relation: "before", toMiddleware: "httpSigningMiddleware", name: "spacesArchiveContentMd5", override: true });
}

/** The S3Client settings this store runs with. Exported for the tests. */
export function archiveClientConfig(cfg: ArchiveConfig): S3ClientConfig {
  return {
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: false,
    maxAttempts: 5,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: cfg.key, secretAccessKey: cfg.secret },
  };
}

export function buildArchiveClient(cfg: ArchiveConfig, extra: Partial<S3ClientConfig> = {}): S3Client {
  const client = new S3Client({ ...archiveClientConfig(cfg), ...extra });
  contentMd5ForDelete(client);
  return client;
}

let cached: { client: S3Client; sig: string } | null = null;
/** Tests only (setArchiveStoreForTests): a fake store, or null for "not configured". */
let override: ObjectStore | null | undefined;

/** Memoized on endpoint + region + key, so a rotated key builds a new client. */
function archiveClient(cfg: ArchiveConfig): S3Client {
  const sig = `${cfg.endpoint}\n${cfg.region}\n${cfg.key}`;
  if (cached?.sig === sig) return cached.client;
  cached = { client: buildArchiveClient(cfg), sig };
  return cached.client;
}

// ── Keys ─────────────────────────────────────────────────────────────────

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export class InvalidKeySegmentError extends Error {
  constructor() {
    super("Invalid id in an object key.");
    this.name = "InvalidKeySegmentError";
  }
}

function seg(id: string): string {
  if (!ID.test(id)) throw new InvalidKeySegmentError();
  return id;
}

export function tenantPrefix(tenantId: string): string {
  return `tenants/${seg(tenantId)}/`;
}

export function crawlArchivePrefix(tenantId: string, crawlId: string): string {
  return `${tenantPrefix(tenantId)}crawls/${seg(crawlId)}/`;
}

export function crawlExportPrefix(tenantId: string, crawlId: string): string {
  return `${tenantPrefix(tenantId)}exports/${seg(crawlId)}/`;
}

/** Page snapshots (ECHORANK-DATA-ARCHIVE.md 1b): where a run's pages live. */
export type PageSource = "crawl" | "ai-lens" | "audit";
export const PAGE_SOURCES: readonly PageSource[] = ["crawl", "ai-lens", "audit"];

export function pagesPrefix(tenantId: string, source: PageSource, runId: string): string {
  if (!PAGE_SOURCES.includes(source)) throw new InvalidKeySegmentError();
  return `${tenantPrefix(tenantId)}pages/${source}/${seg(runId)}/`;
}

// ── The store ────────────────────────────────────────────────────────────

export interface ObjectHead {
  contentLength: number;
  metadata: Record<string, string>;
  lastModified: Date | null;
}

export interface ListedObject {
  key: string;
  size: number;
  lastModified: Date | null;
}

export interface PutOptions {
  contentType?: string;
  contentLength?: number;
  /** x-amz-meta-* (keys lower-case). */
  metadata?: Record<string, string>;
  contentDisposition?: string;
}

export interface ObjectStore {
  /** Streaming multipart upload (a single PUT under the part size). */
  put(key: string, body: Readable | Buffer | string, opts?: PutOptions): Promise<void>;
  /** Streaming download. Throws when the object does not exist. */
  get(key: string): Promise<Readable>;
  /** null when the object does not exist. */
  head(key: string): Promise<ObjectHead | null>;
  /** Batch delete, ≤ 1,000 keys per request. Returns keys deleted. */
  deleteKeys(keys: readonly string[]): Promise<number>;
  /** Every object under a prefix, paginated. */
  list(prefix: string): AsyncIterable<ListedObject>;
  /** The "directories" one level under a prefix (Delimiter "/"). */
  listPrefixes(prefix: string): Promise<string[]>;
  /** A presigned GET against the bucket endpoint, with the download's filename. */
  presignGet(key: string, opts: { filename: string; expiresIn: number; contentType?: string }): Promise<string>;
}

export const DELETE_BATCH = 1_000;

/** RFC 6266 attachment header: an ASCII fallback plus the UTF-8 name. */
export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}

export function s3ObjectStore(client: S3Client, bucket: string): ObjectStore {
  return {
    async put(key, body, opts = {}) {
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: body,
          ...(opts.contentType ? { ContentType: opts.contentType } : {}),
          ...(opts.contentLength !== undefined ? { ContentLength: opts.contentLength } : {}),
          ...(opts.metadata ? { Metadata: opts.metadata } : {}),
          ...(opts.contentDisposition ? { ContentDisposition: opts.contentDisposition } : {}),
        },
        queueSize: 2,
        partSize: 8 * 1024 * 1024,
        leavePartsOnError: false,
      });
      await upload.done();
    },

    async get(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error("Empty object body");
      return res.Body as Readable;
    },

    async head(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { contentLength: Number(res.ContentLength ?? 0), metadata: res.Metadata ?? {}, lastModified: res.LastModified ?? null };
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    async deleteKeys(keys) {
      let deleted = 0;
      for (let i = 0; i < keys.length; i += DELETE_BATCH) {
        const batch = keys.slice(i, i + DELETE_BATCH);
        const res = await client.send(
          new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false } }),
        );
        if (res.Errors?.length) {
          throw new Error(`DeleteObjects failed for ${res.Errors.length} of ${batch.length} keys (${res.Errors[0]?.Code ?? "unknown"})`);
        }
        deleted += batch.length;
      }
      return deleted;
    },

    async *list(prefix) {
      let token: string | undefined;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of res.Contents ?? []) {
          if (o.Key) yield { key: o.Key, size: Number(o.Size ?? 0), lastModified: o.LastModified ?? null };
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
    },

    async listPrefixes(prefix) {
      const out: string[] = [];
      let token: string | undefined;
      do {
        const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/", ContinuationToken: token }));
        for (const p of res.CommonPrefixes ?? []) if (p.Prefix) out.push(p.Prefix);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return out;
    },

    async presignGet(key, opts) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: attachmentDisposition(opts.filename),
          ...(opts.contentType ? { ResponseContentType: opts.contentType } : {}),
        }),
        { expiresIn: opts.expiresIn },
      );
    },
  };
}

/** The configured store, or null. Tests swap in a fake with setArchiveStoreForTests. */
export function archiveStore(): ObjectStore | null {
  if (override !== undefined) return override;
  const cfg = archiveConfig();
  return cfg ? s3ObjectStore(archiveClient(cfg), cfg.bucket) : null;
}

/** Tests only: a fake store (or null for "not configured"); undefined restores the env. */
export function setArchiveStoreForTests(store: ObjectStore | null | undefined): void {
  override = store;
  cached = null;
}

// src/lib/purchase-archive/store.ts — the purchase archive's object store.
//
// The same S3 settings and ObjectStore interface as the crawl archive
// (src/lib/spaces/client.ts: virtual-hosted URLs, 5 attempts, checksums only
// when required, Content-MD5 on DeleteObjects), built from PURCHASE_ARCHIVE_*
// only. Its own memoised client: a rotated or split key builds a new one and
// never touches the crawl archive's.
//
// Private bucket; nothing here sets an ACL, and nothing here presigns. No code
// path serves a purchase-archive object to a user.

import "server-only";

import type { S3Client } from "@aws-sdk/client-s3";
import { buildArchiveClient, s3ObjectStore, type ObjectStore } from "@/lib/spaces/client";
import { purchaseArchiveConfig } from "./config";

let cached: { client: S3Client; sig: string } | null = null;
let override: ObjectStore | null | undefined;

/** The configured purchase store, or null. */
export function purchaseStore(env: NodeJS.ProcessEnv = process.env): ObjectStore | null {
  if (override !== undefined) return override;
  const cfg = purchaseArchiveConfig(env);
  if (!cfg) return null;
  const sig = `${cfg.endpoint}\n${cfg.region}\n${cfg.key}`;
  if (cached?.sig !== sig) {
    cached = {
      client: buildArchiveClient({ endpoint: cfg.endpoint, region: cfg.region, bucket: cfg.bucket, key: cfg.key, secret: cfg.secret }),
      sig,
    };
  }
  return s3ObjectStore(cached.client, cfg.bucket);
}

/** Tests only: a fake store, or null for "not configured"; undefined restores the env. */
export function setPurchaseStoreForTests(store: ObjectStore | null | undefined): void {
  override = store;
  cached = null;
}

// src/lib/purchase-archive/config.ts — Echorank's side of the purchase archive
// (ECHORANK-DATA-ARCHIVE.md): its env, its spool, and which provider calls are
// archived, skipped as not-purchased, or excluded.
//
// ── ITS OWN KEY ────────────────────────────────────────────────────────────
// PURCHASE_ARCHIVE_* is read on its own and never falls back to SPACES_ARCHIVE_*
// (the crawl archive) or SPACES_* (snapshots, the provider cache). Today the
// operator may point two of them at the same Spaces key; nothing here may
// depend on that, so when the keys are split per app nothing changes.
//
// Not configured (any of the five missing) → the archive is off and every
// capture returns at once. Read at call time, never at module load.
//
// Not part of the shared core.ts: these policies are this repo's.

import "server-only";

import type { ArchiveApp } from "./core";

export const ARCHIVE_APP: ArchiveApp = "echorank";

export const PURCHASE_ARCHIVE_ENV = [
  "PURCHASE_ARCHIVE_ENDPOINT",
  "PURCHASE_ARCHIVE_REGION",
  "PURCHASE_ARCHIVE_BUCKET",
  "PURCHASE_ARCHIVE_KEY",
  "PURCHASE_ARCHIVE_SECRET",
] as const;

export interface PurchaseArchiveConfig {
  endpoint: string;
  region: string;
  bucket: string;
  key: string;
  secret: string;
}

/** The five variables, or null when any is missing. Never logged. */
export function purchaseArchiveConfig(env: NodeJS.ProcessEnv = process.env): PurchaseArchiveConfig | null {
  const [endpoint, region, bucket, key, secret] = PURCHASE_ARCHIVE_ENV.map((n) => env[n]?.trim() ?? "");
  if (!endpoint || !region || !bucket || !key || !secret) return null;
  return { endpoint, region, bucket, key, secret };
}

/** Archive on: configured, and not switched off with PURCHASE_ARCHIVE_ENABLED=false. */
export function purchaseArchiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if ((env.PURCHASE_ARCHIVE_ENABLED ?? "").trim().toLowerCase() === "false") return false;
  return purchaseArchiveConfig(env) !== null;
}

/** File per object, mode 600; created by root, owned by echorank, mode 700. */
export function spoolDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.PURCHASE_ARCHIVE_SPOOL_DIR?.trim() || "/var/lib/echorank/purchase-spool";
}

/** Alert #echorank-alerts once a day past either threshold. */
export const SPOOL_ALERT_FILES = 1_000;
export const SPOOL_ALERT_BYTES = 1024 ** 3;

/**
 * Gzipped bodies up to this size ride the BullMQ job; bigger ones go straight
 * to the spool and the next drain uploads them, so Redis never holds a
 * multi-megabyte payload.
 */
export const INLINE_MAX_BYTES = 512 * 1024;

/**
 * The secrets this process holds, by env name. Their values are removed from
 * every serialised body (core.redactSecrets) as the last line of defence.
 */
export const SECRET_ENV = [
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "SERPER_API_KEY",
  "PURCHASE_ARCHIVE_KEY",
  "PURCHASE_ARCHIVE_SECRET",
  "SPACES_ARCHIVE_KEY",
  "SPACES_ARCHIVE_SECRET",
  "SPACES_KEY",
  "SPACES_SECRET",
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_MAPS_API_KEY",
] as const;

export function liveSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  for (const n of SECRET_ENV) {
    const v = env[n]?.trim();
    if (v) out.push(v);
  }
  const login = env.DATAFORSEO_LOGIN?.trim();
  const password = env.DATAFORSEO_PASSWORD?.trim();
  if (login && password) out.push(`${login}:${password}`);
  return out;
}

// ── DataForSEO policy ──────────────────────────────────────────────────────

export type DataforseoDecision =
  | { archive: true; personalData: boolean }
  | { archive: false; reason: "excluded" | "not_purchased" };

function norm(path: string): string {
  return path.replace(/^\/+/, "").replace(/^v3\//, "");
}

/**
 * EXCLUDED (owner's decision, 2026-11-09): DataForSEO's Google Maps and Local
 * Finder SERPs and every Business Data endpoint (listings, Q&A) are Google Maps
 * content resold, so they are treated like Places: never archived.
 */
export function isExcludedDataforseoPath(path: string): boolean {
  const p = norm(path);
  return /^serp\/google\/(maps|local_finder)\//.test(p) || /^business_data\//.test(p);
}

/**
 * NOT PURCHASED DATA: account and reference reads, the queue's ready lists, and
 * task_post acknowledgements (billed, but `result` is null by design — the data
 * arrives with the task_get, which is archived with the post's cost).
 */
export function isNotPurchasedDataforseoPath(path: string): boolean {
  const p = norm(path);
  return (
    /^appendix\//.test(p) ||
    /\/tasks_ready$/.test(p) ||
    /\/tasks_fixed$/.test(p) ||
    /\/task_post$/.test(p) ||
    /\/(locations|languages|categories|id_list|errors)(\/|$)/.test(p)
  );
}

/**
 * MAY CONTAIN PERSONAL DATA: SERP snippets (people named in titles and
 * descriptions), content-analysis citations (authors), and LLM answers and
 * mentions. Labs, Keywords Data, Backlinks and OnPage carry none.
 */
export function dataforseoPersonalData(path: string): boolean {
  const p = norm(path);
  return /^serp\//.test(p) || /^content_analysis\//.test(p) || /^ai_optimization\//.test(p);
}

export function dataforseoDecision(path: string): DataforseoDecision {
  if (isExcludedDataforseoPath(path)) return { archive: false, reason: "excluded" };
  if (isNotPurchasedDataforseoPath(path)) return { archive: false, reason: "not_purchased" };
  return { archive: true, personalData: dataforseoPersonalData(path) };
}

/** Provider names this repo archives under. */
export const PROVIDERS = {
  dataforseo: "dataforseo",
  openai: "openai",
  gemini: "gemini",
  anthropic: "anthropic",
} as const;

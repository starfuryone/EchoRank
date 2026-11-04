// src/lib/site-crawler/amp-validator.ts
//
// The official AMP validator (amphtml-validator) for the crawl worker
// (Phase 4e). The package itself is a loader: the rules live in
// validator_wasm.js on cdn.ampproject.org. A crawl must never depend on that
// CDN answering, so the script is cached on disk under the app's cache dir
// (node_modules/.cache/amphtml-validator, owned by the account that runs
// npm install and the workers) and refreshed at most weekly:
//
//   cache fresh (< 7 days)       → use it;
//   stale or missing             → download (15 s, 8 MB cap), write it
//                                  atomically, use it;
//   download failed, stale copy  → use the stale copy, retry next week… next load;
//   download failed, no copy     → null: AMP pages are still found and their
//                                  links and canonicals checked, only amp.invalid
//                                  does not run (capability "amp" off).
//
// One instance per process, loaded on the first AMP page a crawl meets.

import "server-only";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { newInstance, type Validator } from "amphtml-validator";
import type { AmpValidationFacts } from "@/lib/crawl-rules";
import { logger } from "@/infrastructure/observability/logger";

export const AMP_VALIDATOR_URL = "https://cdn.ampproject.org/v0/validator_wasm.js";
export const AMP_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_SCRIPT_BYTES = 8 * 1024 * 1024;
const MESSAGE_CHARS = 200;

export function ampCacheFile(): string {
  const dir = process.env.AMP_VALIDATOR_CACHE_DIR || path.join(process.cwd(), "node_modules", ".cache", "amphtml-validator");
  return path.join(dir, "validator_wasm.js");
}

export interface AmpLoaderDeps {
  file: string;
  now: () => number;
  download: () => Promise<string>;
  instantiate: (script: string) => Promise<Validator>;
}

async function download(): Promise<string> {
  const res = await fetch(AMP_VALIDATOR_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`validator download: HTTP ${res.status}`);
  const body = await res.text();
  if (body.length > MAX_SCRIPT_BYTES || !body.includes("amp")) throw new Error("validator download: unexpected body");
  return body;
}

async function instantiate(script: string): Promise<Validator> {
  const v = newInstance(script);
  await v.init();
  return v;
}

/** The validator script: the cache when fresh, else a download, else a stale cache, else null. */
export async function loadValidatorScript(deps: AmpLoaderDeps): Promise<string | null> {
  const age = await stat(deps.file).then((s) => deps.now() - s.mtimeMs, () => null);
  if (age !== null && age < AMP_REFRESH_MS) return readFile(deps.file, "utf8");
  try {
    const body = await deps.download();
    await mkdir(path.dirname(deps.file), { recursive: true });
    const tmp = `${deps.file}.${process.pid}.tmp`;
    await writeFile(tmp, body, { mode: 0o644 });
    await rename(tmp, deps.file);
    return body;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err), cached: age !== null }, "amp validator refresh failed");
    return age !== null ? readFile(deps.file, "utf8").catch(() => null) : null;
  }
}

let loading: Promise<Validator | null> | null = null;
let loadedAt = 0;

/** The process's validator, reloaded once the cached script is a week old. Null when none can be had. */
export function ampValidator(overrides: Partial<AmpLoaderDeps> = {}): Promise<Validator | null> {
  const deps: AmpLoaderDeps = { file: ampCacheFile(), now: Date.now, download, instantiate, ...overrides };
  if (loading && deps.now() - loadedAt < AMP_REFRESH_MS) return loading;
  loadedAt = deps.now();
  loading = loadValidatorScript(deps)
    .then((script) => (script ? deps.instantiate(script) : null))
    .catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "amp validator unavailable");
      return null;
    });
  return loading;
}

/** Test seam: forget the process's instance. */
export function resetAmpValidator(): void {
  loading = null;
  loadedAt = 0;
}

export function validateAmp(v: Validator, html: string): AmpValidationFacts {
  const r = v.validateString(html);
  const errors = r.errors.filter((e) => e.severity === "ERROR");
  return {
    status: r.status === "PASS" ? "PASS" : "FAIL",
    errorCount: errors.length,
    messages: errors.slice(0, 3).map((e) => `${e.line}:${e.col} ${e.message}`.slice(0, MESSAGE_CHARS)),
  };
}

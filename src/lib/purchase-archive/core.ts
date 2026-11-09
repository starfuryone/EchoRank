// src/lib/purchase-archive/core.ts — THE SHARED FILE.
//
// ECHORANK-DATA-ARCHIVE.md: every repo that buys data (Echorank, the
// seo-gateway, EchoPilot) carries this same file, so the three archives line up
// in one bucket. Keep it dependency-free (node:crypto and node:zlib only) and
// bump PURCHASE_ARCHIVE_VERSION on any change to what it produces; copy it to
// the other repos verbatim.
//
// What lives here: the object key, the body, the request canonicalisation and
// credential stripping, the request hash, the idempotency key, the object
// metadata and the manifest line. What does NOT: the S3 client, the queue, the
// spool, the index table — those are each repo's own.
//
// ── CREDENTIALS ────────────────────────────────────────────────────────────
// A request is stored only after scrubRequest():
//   1. a DENYLIST drops any key that names a credential (auth headers, login,
//      password, api keys, tokens, cookies), at every depth;
//   2. an ALLOWLIST of known top-level param names is stored as given; any
//      other top-level param is HASHED, never stored ({"$hashed": sha256});
//   3. string values that look like a credential (Basic/Bearer headers, sk-…
//      and AIza… keys, key=/token= query params) are redacted at every depth;
//   4. redactSecrets() then removes every live secret value the caller passes
//      (the repo's own env secrets) from the final serialised body.
// Provider credentials travel in headers, which are never passed here at all;
// the four steps are the belt and braces for a body that carries one anyway.

import { createHash } from "node:crypto";
import { gzip } from "node:zlib";
import { promisify } from "node:util";

/** Bump on any change to keys, body, hashing or scrubbing. */
export const PURCHASE_ARCHIVE_VERSION = "1.0.0";
/** The `v` field of every body and the `v1/` key prefix. */
export const OBJECT_SCHEMA_VERSION = 1;

export type ArchiveApp = "echorank" | "gateway" | "echopilot";

export interface PurchaseInput {
  provider: string;
  /** The provider path or a short name; endpointSlug() normalises it. */
  endpoint: string;
  /** Request params (never headers). Scrubbed before it is stored or hashed. */
  request: unknown;
  /** The response as received. */
  response: unknown;
  costUsd: number | null;
  providerTaskId: string | null;
  tenantId: string | null;
  purpose: string;
}

// ── Canonical JSON and hashing ─────────────────────────────────────────────

/** JSON with object keys sorted at every depth; undefined members dropped. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortDeep(v);
    }
    return out;
  }
  return value;
}

export function sha256Hex(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

// ── Credential stripping ───────────────────────────────────────────────────

/** Normalised (lower-case, no `-`/`_`) key names that are always dropped. */
export const DENY_EXACT: ReadonlySet<string> = new Set([
  "authorization",
  "proxyauthorization",
  "auth",
  "login",
  "user",
  "username",
  "password",
  "passwd",
  "pass",
  "pwd",
  "key",
  "apikey",
  "xapikey",
  "xgoogapikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "secret",
  "clientsecret",
  "cookie",
  "setcookie",
  "sessionid",
  "credentials",
  "bearer",
  "privatekey",
  "signature",
]);

/** Substrings that drop a key wherever they appear in its normalised name. */
export const DENY_SUBSTRINGS: readonly string[] = [
  "password",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "credential",
  "privatekey",
  "accesstoken",
  "refreshtoken",
  "bearer",
  "oauth",
];

/**
 * Top-level request params stored as given. Anything else is hashed. Covers the
 * DataForSEO task fields the three repos send, DataForSEO's own echo of the
 * task (`api`, `function`, `se`, `se_type`), Serper's query fields, and the
 * LLM request bodies (OpenAI Responses, Gemini generateContent, Anthropic).
 */
export const ALLOWED_PARAMS: ReadonlySet<string> = new Set([
  // DataForSEO
  "api", "function", "se", "se_type", "id", "tag", "priority",
  "keyword", "keywords", "target", "targets", "url", "urls", "word",
  "location_code", "location_name", "location_coordinate", "language_code", "language_name",
  "se_domain", "device", "os", "depth", "max_crawl_pages", "search_param", "calculate_rectangles",
  "include_serp_info", "include_subdomains", "include_clickstream_data", "include_seed_keyword",
  "include_indirect_links", "include_ai_overview", "exclude_internal_backlinks", "exclude_top_domains",
  "historical_serp_mode", "ignore_synonyms", "intersection_mode", "item_types", "item_types_to_ignore",
  "limit", "offset", "offset_token", "filters", "order_by", "sort_by", "mode", "rank_scale",
  "backlinks_status_type", "backlinks_filters", "internal_list_limit", "date_from", "date_to",
  "page_type", "search_mode", "search_partners", "exact_match", "keyword_fields", "category",
  "category_codes", "max_rank_group", "load_resources", "enable_javascript", "enable_browser_rendering",
  "custom_user_agent", "for_mobile", "platform", "aggregation_key", "user_prompt", "model_name",
  "web_search", "force_web_search", "web_search_country_iso_code", "web_search_city",
  "expand_ai_overview", "load_async_ai_overview", "people_also_ask_click_depth",
  // Serper
  "q", "gl", "hl", "num", "page", "tbs", "type", "autocorrect", "location",
  // LLM request bodies
  "model", "instructions", "input", "tools", "tool_choice", "include", "max_output_tokens",
  "reasoning", "store", "text", "systemInstruction", "contents", "generationConfig",
  "system", "messages", "max_tokens", "systemPrompt", "userPrompt", "prompt", "modelId", "maxTokens",
  "temperature", "top_p",
]);

const REDACTED = "[redacted]";

function normKey(k: string): string {
  return k.toLowerCase().replace(/[-_\s]/g, "");
}

export function isDeniedKey(k: string): boolean {
  const n = normKey(k);
  return DENY_EXACT.has(n) || DENY_SUBSTRINGS.some((s) => n.includes(s));
}

const VALUE_PATTERNS: readonly RegExp[] = [
  /\b(?:Basic|Bearer|Token)\s+[A-Za-z0-9+/=._~-]{8,}/gi,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
];
const QUERY_SECRET = /([?&;](?:key|api_key|apikey|token|access_token|password|secret|sig|signature)=)[^&#\s"]+/gi;

export function redactValueString(s: string): string {
  let out = s.replace(QUERY_SECRET, `$1${REDACTED}`);
  for (const p of VALUE_PATTERNS) out = out.replace(p, REDACTED);
  return out;
}

/** Drop denied keys and redact credential-shaped strings, at every depth. */
export function scrubDeep(value: unknown): unknown {
  if (typeof value === "string") return redactValueString(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isDeniedKey(k)) continue;
      out[k] = scrubDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * The request as it may be stored: denied keys gone at every depth, known
 * top-level params kept (scrubbed), unknown top-level params hashed. An array
 * (DataForSEO's one-task POST body) is scrubbed element by element.
 */
export function scrubRequest(request: unknown): unknown {
  if (Array.isArray(request)) return request.map(scrubRequest);
  if (!request || typeof request !== "object") return scrubDeep(request);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(request as Record<string, unknown>)) {
    if (isDeniedKey(k)) continue;
    out[k] = ALLOWED_PARAMS.has(k) ? scrubDeep(v) : { $hashed: sha256Hex(canonicalJson(v ?? null)) };
  }
  return out;
}

/** sha256 of the canonical scrubbed request: sorted params, no credentials. */
export function requestHash(request: unknown): string {
  return sha256Hex(canonicalJson(scrubRequest(request)));
}

/** Remove every given live secret (and its base64 form) from a serialised body. */
export function redactSecrets(serialised: string, secrets: readonly string[]): string {
  let out = serialised;
  for (const s of secrets) {
    if (!s || s.length < 6) continue;
    for (const form of [s, Buffer.from(s).toString("base64")]) {
      out = out.split(form).join(REDACTED);
    }
  }
  return out;
}

// ── Keys ───────────────────────────────────────────────────────────────────

const UUIDISH = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{20,}|\d{6,}(?:-\d+)*)$/i;

/**
 * "v3/serp/google/organic/task_get/advanced/<uuid>" → "serp-google-organic-task_get-advanced".
 * The version prefix and any id segment are dropped; anything outside
 * [a-z0-9_.] becomes "_", so a slug is always one safe key segment.
 */
export function endpointSlug(endpoint: string): string {
  const kept = endpoint
    .split(/[?#]/)[0]!
    .split("/")
    .filter(Boolean)
    .filter((p, i) => !(i === 0 && /^v\d+(?:beta)?$/i.test(p)))
    .filter((p) => !UUIDISH.test(p))
    .map((p) => p.toLowerCase().replace(/[^a-z0-9_.]/g, "_"));
  return kept.join("-").slice(0, 120) || "unknown";
}

function providerSeg(provider: string): string {
  return provider.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) || "unknown";
}

function ymd(d: Date): [string, string, string] {
  return [
    String(d.getUTCFullYear()),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ];
}

/** v1/<app>/<provider>/<endpoint-slug>/<YYYY>/<MM>/<DD>/<requestHash>-<epochMs>.json.gz */
export function objectKey(p: { app: ArchiveApp; provider: string; endpoint: string; requestHash: string; receivedAt: Date }): string {
  const [y, m, d] = ymd(p.receivedAt);
  return `v${OBJECT_SCHEMA_VERSION}/${p.app}/${providerSeg(p.provider)}/${endpointSlug(p.endpoint)}/${y}/${m}/${d}/${p.requestHash}-${p.receivedAt.getTime()}.json.gz`;
}

/** v1/<app>/_manifests/<YYYY-MM-DD>.ndjson.gz */
export function manifestKey(app: ArchiveApp, day: Date): string {
  const [y, m, d] = ymd(day);
  return `v${OBJECT_SCHEMA_VERSION}/${app}/_manifests/${y}-${m}-${d}.ndjson.gz`;
}

/**
 * The idempotency key. The same provider task (per endpoint and request — a
 * paginated read of one task is several objects) or, without a task id, the
 * same request received at the same millisecond, is written once.
 */
export function dedupeKey(p: {
  app: ArchiveApp;
  provider: string;
  endpoint: string;
  requestHash: string;
  providerTaskId: string | null;
  receivedAt: Date;
}): string {
  const who = `${p.app}|${providerSeg(p.provider)}|${endpointSlug(p.endpoint)}`;
  return sha256Hex(
    p.providerTaskId ? `${who}|task:${p.providerTaskId}|${p.requestHash}` : `${who}|${p.requestHash}|at:${p.receivedAt.getTime()}`,
  );
}

// ── The object ─────────────────────────────────────────────────────────────

export interface ArchiveBody {
  v: number;
  app: ArchiveApp;
  provider: string;
  endpoint: string;
  request: unknown;
  response: unknown;
  costUsd: number | null;
  providerTaskId: string | null;
  tenantId: string | null;
  purpose: string;
  receivedAt: string;
}

export interface PreparedObject {
  app: ArchiveApp;
  provider: string;
  endpoint: string;
  requestHash: string;
  dedupeKey: string;
  s3Key: string;
  costUsd: number | null;
  providerTaskId: string | null;
  tenantId: string | null;
  purpose: string;
  personalData: boolean;
  receivedAt: string;
  /** Gzipped body size. */
  bytes: number;
  gz: Buffer;
}

const gzipAsync = promisify(gzip);

/** Build the scrubbed, gzipped object and everything its index row needs. */
export async function prepareObject(
  app: ArchiveApp,
  input: PurchaseInput,
  opts: { personalData: boolean; receivedAt?: Date; secrets?: readonly string[] },
): Promise<PreparedObject> {
  const receivedAt = opts.receivedAt ?? new Date();
  const endpoint = endpointSlug(input.endpoint);
  const request = scrubRequest(input.request);
  const hash = sha256Hex(canonicalJson(request));
  const body: ArchiveBody = {
    v: OBJECT_SCHEMA_VERSION,
    app,
    provider: providerSeg(input.provider),
    endpoint,
    request,
    response: input.response,
    costUsd: input.costUsd,
    providerTaskId: input.providerTaskId,
    tenantId: input.tenantId,
    purpose: input.purpose,
    receivedAt: receivedAt.toISOString(),
  };
  const json = redactSecrets(JSON.stringify(body), opts.secrets ?? []);
  const gz = await gzipAsync(Buffer.from(json, "utf8"));
  return {
    app,
    provider: body.provider,
    endpoint,
    requestHash: hash,
    dedupeKey: dedupeKey({ app, provider: body.provider, endpoint, requestHash: hash, providerTaskId: input.providerTaskId, receivedAt }),
    s3Key: objectKey({ app, provider: body.provider, endpoint, requestHash: hash, receivedAt }),
    costUsd: input.costUsd,
    providerTaskId: input.providerTaskId,
    tenantId: input.tenantId,
    purpose: input.purpose,
    personalData: opts.personalData,
    receivedAt: body.receivedAt,
    bytes: gz.length,
    gz,
  };
}

/** x-amz-meta-* for an object: provider, endpoint, cost, tenant (+ app, version, personal). */
export function objectMetadata(o: Pick<PreparedObject, "app" | "provider" | "endpoint" | "costUsd" | "tenantId" | "personalData">): Record<string, string> {
  return {
    app: o.app,
    v: String(OBJECT_SCHEMA_VERSION),
    provider: o.provider,
    endpoint: o.endpoint,
    cost: o.costUsd === null ? "unknown" : String(o.costUsd),
    tenant: o.tenantId ?? "none",
    personal: o.personalData ? "1" : "0",
  };
}

export interface ManifestRow {
  s3Key: string;
  requestHash: string;
  provider: string;
  endpoint: string;
  costUsd: number | null;
  bytes: number;
  tenantId: string | null;
  createdAt: Date;
}

/** One manifest line: key, hash, provider, endpoint, cost, bytes, tenant, ts. */
export function manifestLine(r: ManifestRow): string {
  return JSON.stringify({
    key: r.s3Key,
    hash: r.requestHash,
    provider: r.provider,
    endpoint: r.endpoint,
    cost: r.costUsd,
    bytes: r.bytes,
    tenant: r.tenantId,
    ts: r.createdAt.toISOString(),
  });
}

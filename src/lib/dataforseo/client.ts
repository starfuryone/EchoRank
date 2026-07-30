/**
 * src/lib/dataforseo/client.ts
 *
 * Hand-rolled DataForSEO v3 client for Echorank360.
 * Replaces open-seo's `dataforseo-client` SDK usage (~3 MB) with plain fetch —
 * every v3 endpoint is a POST of a JSON array of task objects.
 *
 * Envelope/billing semantics adapted from open-seo (MIT, (c) 2026 Ben Senescu).
 *
 * Env: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD
 */

import { fixturesEnabled, loadFixture, recordingEnabled, saveFixture } from "./fixtures";

const API_BASE = "https://api.dataforseo.com";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 250;
const MAX_ERROR_PAYLOAD = 1600;

// DataForSEO task-level status codes: 20000 = ok. 40501/40502 = invalid field.
const STATUS_OK = 20000;
// 20100 "Task Created." — the success code for every *_task_post endpoint.
// The task is accepted, billed, and has an id; `result` is null by design.
const STATUS_TASK_CREATED = 20100;

function isTaskSuccess(code: number | undefined): boolean {
  return code === STATUS_OK || code === STATUS_TASK_CREATED;
}

export type CreditFeature =
  | "keyword_research"
  | "domain_overview"
  | "backlinks"
  | "site_audit"
  | "rank_tracking"
  | "local_seo"
  | "content_research";

export type ApiCallCost = { path: string[]; costUsd: number };
/** `taskId` is DataForSEO's own task uuid — set on every envelope, and the
 * handle the async queue (tasks_ready / task_get) is polled with. */
export type ApiResult<T> = { data: T; billing: ApiCallCost; taskId?: string };

export class DataforseoError extends Error {
  constructor(
    message: string,
    readonly code:
      | "AUTH_FAILED"
      | "RATE_LIMITED"
      | "UPSTREAM_UNAVAILABLE"
      | "INVALID_FIELD"
      | "TASK_FAILED"
      | "INTERNAL",
    /** Present when DataForSEO billed the call despite failing it. */
    readonly billing?: ApiCallCost,
    readonly providerPath?: string,
  ) {
    super(message);
    this.name = "DataforseoError";
  }
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new DataforseoError(
      "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured",
      "AUTH_FAILED",
    );
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function truncate(text: string): string {
  return text.length > MAX_ERROR_PAYLOAD
    ? `${text.slice(0, MAX_ERROR_PAYLOAD)}... [truncated]`
    : text;
}

type RawTask = {
  id?: string;
  status_code?: number;
  status_message?: string;
  path?: string[];
  cost?: number;
  result?: unknown[];
};

type RawResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: RawTask[];
};

function buildBilling(task: RawTask, fallbackPath: string): ApiCallCost {
  return {
    path: task.path ?? fallbackPath.split("/").filter(Boolean),
    costUsd: typeof task.cost === "number" ? task.cost : 0,
  };
}

/**
 * Maps a DataForSEO response path to a product feature, for metering.
 * Ported from open-seo `mapDataforseoPathToCreditFeature`.
 */
export function pathToFeature(path: readonly string[]): CreditFeature {
  const p = path[0] === "v3" ? path : ["v3", ...path];
  switch (p[1]) {
    case "on_page":
      return "site_audit";
    case "backlinks":
      return "backlinks";
    case "serp":
      return p[2] === "google" && ["maps", "local_finder"].includes(p[3] ?? "")
        ? "local_seo"
        : "keyword_research";
    case "business_data":
      return "local_seo";
    case "keywords_data":
      return "keyword_research";
    // Content Explorer. Without this case content_analysis fell through to the
    // default and every mention search was metered as "site_audit", which makes
    // per-feature spend reporting quietly wrong.
    case "content_analysis":
      return "content_research";
    case "dataforseo_labs": {
      const endpoint = p[3] ?? "";
      return endpoint.startsWith("domain_") ||
        endpoint === "ranked_keywords" ||
        endpoint === "relevant_pages"
        ? "domain_overview"
        : "keyword_research";
    }
    default:
      return "site_audit";
  }
}

/**
 * POST a single task to a v3 endpoint and return its first result envelope.
 *
 * `path` is the endpoint without the leading slash, e.g.
 * "v3/dataforseo_labs/google/domain_rank_overview/live".
 */
export async function postTask<T = unknown>(
  path: string,
  task: Record<string, unknown>,
  opts?: { signal?: AbortSignal },
): Promise<ApiResult<T>> {
  return request<T>("POST", path, {
    body: JSON.stringify([task]),
    signal: opts?.signal,
  });
}

/**
 * GET a v3 endpoint that takes no task body — the async-queue reads
 * (`tasks_ready`, `task_get/advanced/<id>`). Both are FREE at DataForSEO, so
 * callers use these directly instead of going through meteredCall.
 *
 * `fixtureKey` overrides the fixture filename: `task_get/advanced/<id>` embeds
 * a per-task id in the path, which would otherwise never replay.
 */
export async function getEndpoint<T = unknown>(
  path: string,
  opts?: { signal?: AbortSignal; fixtureKey?: string },
): Promise<ApiResult<T>> {
  return request<T>("GET", path, {
    signal: opts?.signal,
    fixtureKey: opts?.fixtureKey,
  });
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  opts: { body?: string; signal?: AbortSignal; fixtureKey?: string },
): Promise<ApiResult<T>> {
  const fixtureKey = opts.fixtureKey ?? path;

  // DATAFORSEO_FIXTURES=1 — serve recorded envelopes, zero live spend.
  if (fixturesEnabled()) {
    const envelope = loadFixture(fixtureKey);
    if (envelope) return parseEnvelope<T>(envelope as RawResponse, path);
    throw new DataforseoError(
      `DATAFORSEO_FIXTURES=1 but no fixture recorded for /${fixtureKey}`,
      "INTERNAL",
      undefined,
      path,
    );
  }

  const url = `${API_BASE}/${path}`;
  const signal = opts.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const headers = {
    Authorization: authHeader(),
    "Content-Type": "application/json",
  };

  let response: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(url, { method, headers, body: opts.body, signal });
    if (response.ok) break;
    if (response.status >= 500 && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
      continue;
    }
    const raw = truncate(await response.text());
    throw new DataforseoError(
      `DataForSEO HTTP ${response.status} on /${path}: ${raw}`,
      response.status === 401
        ? "AUTH_FAILED"
        : response.status === 429
          ? "RATE_LIMITED"
          : response.status >= 500
            ? "UPSTREAM_UNAVAILABLE"
            : "INTERNAL",
      undefined,
      path,
    );
  }

  const json = (await response.json()) as RawResponse;

  // DATAFORSEO_RECORD=1 — persist the live envelope for later replay. Written
  // before parsing so a failing envelope is still inspectable on disk.
  if (recordingEnabled()) {
    try {
      saveFixture(fixtureKey, json);
    } catch (err) {
      console.error(
        `[dataforseo] fixture record failed for /${fixtureKey}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return parseEnvelope<T>(json, path);
}

/** Shared envelope → result/billing parsing (live responses and fixtures). */
function parseEnvelope<T>(json: RawResponse, path: string): ApiResult<T> {
  const t = json.tasks?.[0];

  if (!t) {
    throw new DataforseoError(
      `DataForSEO returned no task for /${path} (${json.status_code} ${json.status_message})`,
      "TASK_FAILED",
      undefined,
      path,
    );
  }

  if (!isTaskSuccess(t.status_code)) {
    const message = t.status_message ?? "unknown task failure";
    const invalidField = /invalid field/i.test(message);
    const billed = typeof t.cost === "number" && t.cost > 0;
    throw new DataforseoError(
      `DataForSEO task ${t.status_code} on /${path}: ${message}`,
      invalidField ? "INVALID_FIELD" : "TASK_FAILED",
      // Only surface billing when they actually charged us — the caller meters
      // charged failures and skips uncharged ones.
      billed ? buildBilling(t, path) : undefined,
      path,
    );
  }

  return {
    data: (t.result ?? []) as T,
    billing: buildBilling(t, path),
    taskId: t.id,
  };
}

/**
 * Wraps postTask with tenant metering + monthly USD cap.
 * Call this from route handlers; never call postTask directly from a route.
 */
export async function meteredCall<T>(
  ctx: { tenantId: string; monthlyCapUsd: number },
  path: string,
  task: Record<string, unknown>,
  deps: MeteringDeps,
): Promise<T> {
  return (await meteredCallResult<T>(ctx, path, task, deps)).data;
}

export type MeteringDeps = {
  spentThisMonth: (tenantId: string) => Promise<number>;
  record: (row: {
    tenantId: string;
    feature: CreditFeature;
    path: string;
    costUsd: number;
    ok: boolean;
  }) => Promise<void>;
};

/**
 * Same guarantees as meteredCall, but hands back the whole envelope result —
 * async-queue callers need `billing.costUsd` and `taskId` to persist the row
 * they will later poll.
 */
export async function meteredCallResult<T>(
  ctx: { tenantId: string; monthlyCapUsd: number },
  path: string,
  task: Record<string, unknown>,
  deps: MeteringDeps,
): Promise<ApiResult<T>> {
  const spent = await deps.spentThisMonth(ctx.tenantId);
  if (spent >= ctx.monthlyCapUsd) {
    throw new DataforseoError(
      "Monthly SEO data budget reached for this workspace",
      "RATE_LIMITED",
    );
  }

  try {
    const result = await postTask<T>(path, task);
    const { billing } = result;
    await deps.record({
      tenantId: ctx.tenantId,
      feature: pathToFeature(billing.path),
      path: billing.path.join("/"),
      costUsd: billing.costUsd,
      ok: true,
    });
    return result;
  } catch (err) {
    // Charged-but-failed tasks still cost money — record them. Uncharged
    // failures (our malformed request) are not billed and not recorded.
    if (err instanceof DataforseoError && err.billing) {
      await deps.record({
        tenantId: ctx.tenantId,
        feature: pathToFeature(err.billing.path),
        path: err.billing.path.join("/"),
        costUsd: err.billing.costUsd,
        ok: false,
      });
    }
    throw err;
  }
}

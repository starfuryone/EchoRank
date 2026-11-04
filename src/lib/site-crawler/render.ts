// src/lib/site-crawler/render.ts
//
// Render mode (Phase 3b): which pages go through the sidecar's headless
// Chromium (POST /render, av-service/render.py), and the call itself.
//
// ONE RENDER AT A TIME PER JOB. The crawl fetches FETCH_CONCURRENCY pages at
// once, but renders queue behind a promise chain here, so a job never has more
// than one request open against the sidecar (which itself runs one at a time
// across every job). The ceiling is the plan's rendered pages per crawl,
// counted as ATTEMPTS: the expensive part is the browser time, and a page
// that failed to render spent it too.
//
// A sidecar that is down must not turn a 20-minute crawl into a 20-hour one:
// after RENDER_FAILURE_LIMIT failures in a row the job stops rendering and the
// rest of the crawl runs raw.

import "server-only";
import type { PageFacts, RenderFacts } from "@/lib/crawl-rules";
import { logger } from "@/infrastructure/observability/logger";
import { CRAWLER_USER_AGENT } from "./constants";
import { extractHtmlFacts } from "./facts";
import { THIN_MAX_WORDS, type RenderMode } from "./types";

/** The sidecar's own budget is 20 s plus up to 25 s waiting for its slot. */
export const RENDER_REQUEST_TIMEOUT_MS = 50_000;
/** Phase 4e: the sidecar gives each custom JavaScript snippet 5 s more. */
export const SNIPPET_TIMEOUT_MS = 5_000;
export const RENDER_FAILURE_LIMIT = 5;
/** One retry after a 429 (the sidecar's slot was taken by another crawl). */
const BUSY_RETRY_MS = 3_000;

const SIDECAR = () => process.env.AV_SIDECAR_URL || "http://127.0.0.1:4500";

/** Does render mode pick this page? Only 2xx HTML is ever rendered. */
export function wantsRender(mode: RenderMode, facts: PageFacts): boolean {
  if (mode === "none" || !facts.html) return false;
  if (facts.statusCode === null || facts.statusCode < 200 || facts.statusCode >= 300) return false;
  if (mode === "all") return true;
  return facts.html.wordCount < THIN_MAX_WORDS || facts.html.anchors.length === 0;
}

/** POST /render's response (av-service/render.py). */
export interface SidecarRender {
  finalUrl: string;
  status: number | null;
  jsRedirect: string | null;
  offSite: boolean;
  html: string | null;
  consoleErrors: number;
  consoleSample: string | null;
  viewport: { width: number; scrollWidth: number } | null;
  bodyFontPx: number | null;
  tapTargets: { checked: number; tooClose: number; sample: string | null } | null;
  axe: { version: string; violations: Record<string, { impact: string | null; nodes: number }> } | null;
  /** Phase 4e: one value per snippet sent; null when none were. */
  snippets?: string[] | null;
}

export function toRenderFacts(r: SidecarRender, rootUrl: string): RenderFacts {
  return {
    statusCode: r.status,
    finalUrl: r.finalUrl,
    jsRedirect: r.jsRedirect,
    html: r.html !== null && !r.offSite ? extractHtmlFacts(r.html, r.finalUrl, rootUrl, null) : null,
    consoleErrors: r.consoleErrors ?? 0,
    consoleSample: r.consoleSample ?? null,
    viewport: r.viewport ?? null,
    bodyFontPx: r.bodyFontPx ?? null,
    tapTargets: r.tapTargets ?? null,
    axe: r.axe?.violations ?? null,
    ...(r.snippets ? { snippets: r.snippets } : {}),
  };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** One call to the sidecar. Null on any failure; the reason is logged. */
export async function callSidecarRender(url: string, fetchImpl: FetchLike = fetch, snippets: readonly string[] = []): Promise<SidecarRender | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${SIDECAR()}/render`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({ url, userAgent: CRAWLER_USER_AGENT, ...(snippets.length ? { snippets } : {}) }),
        signal: AbortSignal.timeout(RENDER_REQUEST_TIMEOUT_MS + SNIPPET_TIMEOUT_MS * snippets.length),
      });
    } catch (err) {
      logger.warn({ url, err: err instanceof Error ? err.message : String(err) }, "site-crawl render: sidecar unreachable");
      return null;
    }
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, BUSY_RETRY_MS));
      continue;
    }
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "site-crawl render: sidecar refused");
      return null;
    }
    return (await res.json().catch(() => null)) as SidecarRender | null;
  }
  return null;
}

/** Per-job render state: the ceiling, the one-at-a-time chain, the breaker. */
export class RenderBudget {
  private chain: Promise<unknown> = Promise.resolve();
  private reserved: number;
  private failuresInARow = 0;
  rendered = 0;
  failed = 0;
  stopped = false;

  constructor(
    readonly mode: RenderMode,
    readonly cap: number,
    /** Attempts already made (a retried job resumes its count). */
    attempted = 0,
    private readonly call: (url: string) => Promise<SidecarRender | null> = (u) => callSidecarRender(u),
  ) {
    this.reserved = attempted;
  }

  /** True when the job renders at all: the capability rules key on. */
  get enabled(): boolean {
    return this.mode !== "none" && this.cap > 0;
  }

  get attempted(): number {
    return this.reserved;
  }

  /** Render this page if the mode picks it and the ceiling allows. Null otherwise. */
  async maybeRender(facts: PageFacts): Promise<RenderFacts | null> {
    if (!this.enabled || this.stopped || this.reserved >= this.cap || !wantsRender(this.mode, facts)) return null;
    // Reserved synchronously, before waiting: four fetch workers can reach
    // here at once and the ceiling must hold across them.
    this.reserved++;
    const turn = this.chain.then(() => this.renderOne(facts));
    this.chain = turn.catch(() => {});
    return turn;
  }

  private async renderOne(facts: PageFacts): Promise<RenderFacts | null> {
    if (this.stopped) return null;
    const res = await this.call(facts.finalUrl);
    if (!res) {
      this.failed++;
      if (++this.failuresInARow >= RENDER_FAILURE_LIMIT) {
        this.stopped = true;
        logger.warn({ url: facts.finalUrl }, "site-crawl render: too many failures in a row, rendering stopped for this crawl");
      }
      return null;
    }
    this.failuresInARow = 0;
    this.rendered++;
    return toRenderFacts(res, facts.rootUrl);
  }
}

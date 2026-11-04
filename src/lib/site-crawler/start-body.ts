// src/lib/site-crawler/start-body.ts
//
// The body POST /api/seo/v1/crawl accepts, and its per-tenant start limit.
// Its own module so the route and scripts/crawl-smoke.ts parse a start
// request with the same schema: the smoke test builds its CrawlConfig the way
// the handler does, not a copy of it that can drift.

import { z } from "zod";
import { MAX_URL_LENGTH } from "./url";
import { RENDER_MODES } from "./types";
import { CrawlConfigInputSchema } from "./crawl-config";
import { MAX_LIST_LINES } from "./url-list";

/** Starts per tenant per minute. A floor under the monthly allowance, which
 * for STARTER is only 4 and could otherwise be burned by a double-click. */
export const START_RATE_LIMIT = 3;
export const START_RATE_WINDOW_MS = 60_000;

export const startRateKey = (tenantId: string) => `site-crawl:${tenantId}`;

export const StartCrawlBodySchema = z.object({
  /** Spider mode's start URL. Ignored in list mode. */
  url: z.string().trim().max(MAX_URL_LENGTH).default(""),
  /** Phase 4a list mode: fetch `urls` once each, no discovery. */
  mode: z.enum(["spider", "list"]).default("spider"),
  urls: z.array(z.string().trim().max(MAX_URL_LENGTH)).max(MAX_LIST_LINES).optional(),
  /** Phase 3b. Capped by the plan's rendered pages per crawl. */
  renderMode: z.enum(RENDER_MODES).default("none"),
  /** Phase 4a. Omitted = the defaults. Secrets in clear here, sealed before storage. */
  config: CrawlConfigInputSchema.optional(),
  saveAsDefault: z.boolean().default(false),
});
export type StartCrawlBody = z.infer<typeof StartCrawlBodySchema>;

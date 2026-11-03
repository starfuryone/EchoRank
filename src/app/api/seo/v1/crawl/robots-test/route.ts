/**
 * POST /api/seo/v1/crawl/robots-test — the robots.txt tester (Phase 4a).
 *
 * Body: {url, urls[], customRobots?, agent?}. Fetches the live robots.txt of
 * `url`'s host and, for each pasted URL on that host, answers allow/block and
 * the line that decided it, for the live file and (when given) the draft.
 *
 * Read-only: it fetches one robots.txt with the crawler's own user agent and
 * nothing else, so any robots.txt group may be evaluated ("Googlebot",
 * "Bingbot"…) without a verified site. URLs on another host are reported as
 * such, not judged: a robots.txt only speaks for its own host.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { CONFIG_LIMITS } from "@/lib/site-crawler/crawl-config";
import { CRAWLER_USER_AGENT } from "@/lib/site-crawler/constants";
import { InvalidCrawlUrlError, crawlRouteError } from "@/lib/site-crawler/http";
import { fetchRobots, rulesFromBody, type RobotsRules } from "@/lib/site-crawler/robots";
import { MAX_URL_LENGTH, normalizeCrawlUrl, validateRootUrl } from "@/lib/site-crawler/url";

const MAX_TEST_URLS = 100;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const BodySchema = z.object({
  url: z.string().trim().min(1).max(MAX_URL_LENGTH),
  urls: z.array(z.string().trim().max(MAX_URL_LENGTH)).min(1).max(MAX_TEST_URLS),
  customRobots: z.string().max(CONFIG_LIMITS.customRobotsChars).nullable().optional(),
  /** A robots.txt group token. Default: the crawler's own. */
  agent: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
});

function verdict(rules: RobotsRules, url: string) {
  const line = rules.matchLine(url);
  const text = line && rules.body ? (rules.body.split(/\r?\n/)[line - 1] ?? "").trim().slice(0, 300) : null;
  return { allowed: rules.isAllowed(url), line, text };
}

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const root = validateRootUrl(parsed.data.url);
    if (!root.ok || !root.url) throw new InvalidCrawlUrlError(root.reason ?? "not_a_url");

    const limited = await rateLimit(`site-crawl-robots-test:${tenant.tenantId}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limited.success) {
      return NextResponse.json({ error: "Too many tests in a row. Wait a minute.", code: "RATE_LIMITED" }, { status: 429 });
    }

    const agent = parsed.data.agent ?? CRAWLER_USER_AGENT;
    const host = new URL(root.url).hostname;
    const robotsUrl = new URL("/robots.txt", root.url).toString();
    const live = await fetchRobots(root.url, { agent });
    const draft = parsed.data.customRobots?.trim() ? rulesFromBody(parsed.data.customRobots, robotsUrl, agent) : null;

    const results = parsed.data.urls.filter(Boolean).map((raw) => {
      const url = normalizeCrawlUrl(raw, root.url);
      if (!url) return { url: raw, error: "not_a_url" as const };
      if (new URL(url).hostname !== host) return { url, error: "other_host" as const };
      return { url, live: verdict(live, url), ...(draft ? { custom: verdict(draft, url) } : {}) };
    });

    return NextResponse.json({
      robotsUrl,
      agent,
      // allowAll with no body = no robots.txt (404); !allowAll with no body = unreadable, so everything is blocked.
      live: { found: live.body !== null, unreachable: !live.allowAll && live.body === null },
      results,
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}

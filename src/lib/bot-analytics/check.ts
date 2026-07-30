// src/lib/bot-analytics/check.ts
//
// Runs one access check and shapes it for storage and for the UI. Kept out of
// the route so the route stays about HTTP and this stays testable.

import { sidecarPost } from "@/lib/av-sidecar";
import { BOT_CATALOG, BOT_TOKENS } from "@/lib/bot-catalog";
import { BOT_PROBE_SPECS, type ProbeableBot } from "@/lib/bot-analytics/user-agents";
import { deriveVerdict, type BotVerdict, type RobotsRule } from "@/lib/bot-analytics/verdict";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";

interface SidecarBotState {
  status: RobotsRule;
  detail: string;
}
interface SidecarProbe {
  ok: boolean;
  status: number | null;
}
interface SidecarBotsResponse {
  url?: string;
  robots_present?: boolean;
  bots?: Record<string, SidecarBotState>;
  probes?: Record<string, SidecarProbe>;
  sitemap?: { found: boolean; urls: string[] };
  llms_txt?: boolean;
  error?: string;
}

/** What we persist per bot, and what the UI renders. */
export interface BotResult {
  token: string;
  robotsRule: RobotsRule;
  robotsDetail: string;
  /** null when the bot was not probed (preference token) or the probe failed. */
  httpStatus: number | null;
  /** False for the robots.txt-only preference tokens. */
  probed: boolean;
  verdict: BotVerdict;
}

export interface AccessCheckResult {
  domain: string;
  robotsPresent: boolean;
  sitemapFound: boolean;
  llmsTxt: boolean;
  results: Record<string, BotResult>;
  error?: string;
}

/** The UA map the sidecar probes with. Preference tokens are excluded here. */
export function probeUserAgents(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of BOT_TOKENS) {
    const spec = BOT_PROBE_SPECS[token];
    if (spec?.probeable) out[token] = (spec as ProbeableBot).userAgent;
  }
  return out;
}

/**
 * Client timeout for the check.
 *
 * Must sit ABOVE the sidecar's own ceiling (PROBE_TOTAL_BUDGET_S = 45s for the
 * probe loop, plus robots.txt/sitemap/llms.txt fetches) and BELOW Cloudflare's
 * 100s proxy timeout, since this is called synchronously from a button click.
 * Abandoning a check the sidecar is still serving would spend the tenant's
 * monthly allowance and show them nothing.
 */
export const CHECK_TIMEOUT_MS = 75_000;

/**
 * Runs robots evaluation plus the UA probe for one domain.
 *
 * `domain` must already be a tenant-owned hostname — the SSRF guard runs here as
 * the last gate before anything leaves the box, and a rejection is a thrown
 * error rather than a silent skip so a resolution bug can never turn into a
 * fetch of somebody else's site.
 */
export async function runAccessCheck(domain: string): Promise<AccessCheckResult> {
  const guard = guardCheckUrl(domain, domain);
  if (!guard.ok || !guard.url) {
    throw new Error(`Refusing to check ${domain}: ${guard.reason ?? "invalid URL"}`);
  }

  const userAgents = probeUserAgents();
  const { status, data } = await sidecarPost<SidecarBotsResponse>(
    "/bots",
    { url: guard.url, bots: BOT_TOKENS, user_agents: userAgents },
    { timeoutMs: CHECK_TIMEOUT_MS },
  );

  if (status !== 200 || !data.bots || data.error) {
    throw new Error(data.error || "Access check failed upstream.");
  }

  const results: Record<string, BotResult> = {};
  for (const bot of BOT_CATALOG) {
    const token = bot.token;
    const robots = data.bots[token];
    // A bot the sidecar did not answer for is reported unknown, not allowed.
    const robotsRule: RobotsRule = robots?.status === "BLOCKED" ? "BLOCKED" : "ALLOWED";
    const missing = !robots;
    const spec = BOT_PROBE_SPECS[token];
    const probeable = Boolean(spec?.probeable);
    const probe = data.probes?.[token];

    const httpStatus = probe?.ok ? (probe.status ?? null) : null;
    const verdict: BotVerdict = missing
      ? "unknown"
      : deriveVerdict(
          robotsRule,
          probeable ? { httpStatus: probe ? httpStatus : null } : null,
        );

    results[token] = {
      token,
      robotsRule,
      robotsDetail: robots?.detail ?? "",
      httpStatus,
      probed: probeable && Boolean(probe),
      verdict,
    };
  }

  return {
    domain,
    robotsPresent: data.robots_present ?? false,
    sitemapFound: data.sitemap?.found ?? false,
    llmsTxt: data.llms_txt ?? false,
    results,
  };
}

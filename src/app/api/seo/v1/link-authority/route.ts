// POST /api/seo/v1/link-authority — one Link Authority check, the full report.
// Body: { domain, competitors?: string[] (≤3), locale? }.
// GET  /api/seo/v1/link-authority — this month's usage { used, limit, resetsAt }.
//
// PAID, EVERY PLAN (2026-11-09). Guard chain, cheapest refusal first:
//   requirePaidPlan (no session → 401, unpaid → 403; a trial follows its rule:
//   TRIALING counts only with a Stripe PLAN subscription row) → the plan
//   allowlist (area "link_authority", open on the AI-only plan too; the proxy
//   enforces it as well) → validate → per-minute rate limit → the 7-day domain
//   cache → the monthly check allowance (429 at the limit) → DataForSEO,
//   metered to the tenant. A check answered wholly from cache uses no allowance.
//
// AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.

import { z } from "zod";
import { logger } from "@/infrastructure/observability/logger";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_COMPETITORS } from "@/lib/authority-checker/config";
import { linkAuthorityMember as member } from "@/lib/authority-checker/gate";
import { normalizeCheck } from "@/lib/authority-checker/domains";
import { runLinkAuthorityCheck } from "@/lib/authority-checker/service";
import {
  LinkAuthorityQuotaExceededError,
  LinkAuthorityQuotaUnavailableError,
  linkAuthorityUsage,
} from "@/lib/authority-checker/quota";
import { authorityError, authorityErrorMessage, authorityJson } from "@/lib/authority-checker/http";

const Body = z.object({
  domain: z.string().max(300),
  competitors: z.array(z.string().max(300)).max(MAX_COMPETITORS * 2).optional(),
  locale: z.string().max(10).optional(),
});

/** Checks per tenant per minute: a floor under the monthly allowance, against a scripted burst. */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale");
  const gate = await member(locale);
  if (!gate.ok) return gate.res;
  return authorityJson(await linkAuthorityUsage(gate.m.tenantId, gate.m.tenant.planType));
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  const locale = parsed.success ? parsed.data.locale : undefined;

  const gate = await member(locale);
  if (!gate.ok) return gate.res;
  const { m } = gate;

  if (!parsed.success) return authorityError(locale, "invalid_domain", 400);
  const input = normalizeCheck(parsed.data);
  if (!input.ok) return authorityError(locale, input.error, 400);

  const limited = await rateLimit(`link-authority:${m.tenantId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.success) return authorityError(locale, "unavailable", 429);

  try {
    const report = await runLinkAuthorityCheck({
      tenantId: m.tenantId,
      plan: m.tenant.planType,
      domain: input.domain,
      competitors: input.competitors,
    });
    return authorityJson(report);
  } catch (err) {
    if (err instanceof LinkAuthorityQuotaExceededError) {
      // Typed body so the page renders used / limit, the reset date and the upgrade link.
      return authorityJson(
        { error: authorityErrorMessage(locale, "quota"), code: "quota", usage: err.usage, upgradeHref: "/billing" },
        { status: 429 },
      );
    }
    if (err instanceof LinkAuthorityQuotaUnavailableError) return authorityError(locale, "unavailable", 503);
    logger.error({ err, tenantId: m.tenantId, domain: input.domain }, "link authority: check failed");
    return authorityError(locale, "upstream", 503);
  }
}

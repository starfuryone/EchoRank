// POST /api/free/v1/authority-checker — a new Website Authority Check.
// Body: { domain, competitors?: string[] (≤3), turnstileToken, locale? }.
//
// Order, cheapest refusal first and the cache before any allowance:
//   validate → IP → Turnstile (every check) → cache → budget → IP limit
//   (10 new checks a day) → buy → store → the free view.
// A check whose domains are all cached costs nothing and uses no allowance,
// like every free tool here. The budget is read BEFORE the allowance is
// consumed, so a visitor is not charged a check on a day the tool is closed.
// PUBLIC: /api/free/v1/ is in publicPaths; CSRF still applies.

import { z } from "zod";
import { verifyTurnstile } from "@/lib/snapshot/turnstile";
import { consumeDailyLimit, refundDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { logger } from "@/infrastructure/observability/logger";
import { CHECKS_PER_IP_PER_DAY, MAX_COMPETITORS, AUTHORITY_SLUG } from "@/lib/authority-checker/config";
import { normalizeCheck } from "@/lib/authority-checker/domains";
import { budgetState } from "@/lib/authority-checker/data";
import { cachedPreview, completePreview, isBudgetError, previewComplete } from "@/lib/authority-checker/service";
import { newToken, saveCheck, toView } from "@/lib/authority-checker/store";
import { authorityError, authorityJson } from "@/lib/authority-checker/http";
import type { StoredCheck } from "@/lib/authority-checker/types";

const Body = z.object({
  domain: z.string().max(300),
  competitors: z.array(z.string().max(300)).max(MAX_COMPETITORS * 2).optional(),
  turnstileToken: z.string().max(2048).optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  const locale = parsed.success ? parsed.data.locale : undefined;
  if (!parsed.success) return authorityError(locale, "invalid_domain", 400);

  const input = normalizeCheck(parsed.data);
  if (!input.ok) return authorityError(locale, input.error, 400);

  const ip = visitorIp(request);
  if (!ip) return authorityError(locale, "no_ip", 403);
  const turnstile = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (turnstile === "unconfigured") return authorityError(locale, "unavailable", 503);
  if (turnstile !== "ok") return authorityError(locale, "turnstile", 403);

  const now = new Date();
  const preview = await cachedPreview(input.domain, input.competitors, now);
  let authority = preview.authority;
  let links = preview.links;

  if (!previewComplete(preview)) {
    if ((await budgetState(now)).exhausted) return authorityError(locale, "budget", 429);
    const limit = await consumeDailyLimit(AUTHORITY_SLUG, ip, CHECKS_PER_IP_PER_DAY);
    if (!limit.ok) {
      if (limit.reason === "rate_limited") return authorityError(locale, "rate_limited", 429);
      return authorityError(locale, limit.reason === "no_ip" ? "no_ip" : "unavailable", limit.reason === "no_ip" ? 403 : 503);
    }
    try {
      ({ authority, links } = await completePreview(preview, input.domain, now));
    } catch (err) {
      await refundDailyLimit(AUTHORITY_SLUG, ip);
      if (isBudgetError(err)) return authorityError(locale, "budget", 429);
      logger.error({ err, domain: input.domain }, "authority checker: DataForSEO purchase failed");
      return authorityError(locale, "upstream", 503);
    }
  }

  const check: StoredCheck = {
    token: newToken(),
    createdAt: now.toISOString(),
    domain: input.domain,
    competitors: input.competitors,
    authority,
    links: links!,
    full: null,
  };
  if (!(await saveCheck(check))) return authorityError(locale, "unavailable", 503);
  return authorityJson(toView(check, false));
}

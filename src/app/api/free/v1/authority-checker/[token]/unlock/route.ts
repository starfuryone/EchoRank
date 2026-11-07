// POST /api/free/v1/authority-checker/{token}/unlock — the email gate.
// Body: { email, consent?, locale? }.
//
// Stores the lead (free_crawl_leads, source "authority-checker"; a consented
// one goes to Brevo by double opt-in), sets this browser's unlock cookie, then
// buys the full section (top 10 referring domains, competitors' summaries)
// unless it is cached or today's budget is spent. 20 unlocks per IP per day.
//
// Blocked-country rule (src/lib/geo/blocked-countries.ts): the tool stays open
// everywhere, but a lead from the EU/EEA/UK is not stored (no row, no Brevo).
//
// Idempotent: posting again (the page's "Try again" after a budget day) fills
// the section once the budget allows, and never stores the same lead twice.

import { z } from "zod";
import { consumeDailyLimit, visitorIp } from "@/lib/free-tools/limits";
import { cfCountry, isBlockedCountry } from "@/lib/geo/blocked-countries";
import { logger } from "@/infrastructure/observability/logger";
import { AUTHORITY_SLUG, UNLOCKS_PER_IP_PER_DAY } from "@/lib/authority-checker/config";
import { authorityLocale } from "@/lib/authority-checker/copy";
import { ensureFull } from "@/lib/authority-checker/service";
import { loadCheck, recordAuthorityLead, requestUnlocked, saveCheck, toView, unlockCookie } from "@/lib/authority-checker/store";
import { authorityError, authorityJson } from "@/lib/authority-checker/http";

const Body = z.object({
  email: z.string().trim().max(254).email(),
  consent: z.boolean().optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  const locale = (raw && typeof raw === "object" && typeof (raw as { locale?: unknown }).locale === "string")
    ? (raw as { locale: string }).locale
    : undefined;

  const check = await loadCheck(token);
  if (!check) return authorityError(locale, "not_found", 404);
  const ip = visitorIp(request);
  if (!ip) return authorityError(locale, "no_ip", 403);
  // A browser that already unlocked may retry the full section without
  // re-entering an email (the page's "Try again"); everyone else needs one.
  const already = requestUnlocked(request, token);
  if (!parsed.success && !already) return authorityError(locale, "invalid_email", 400);
  const cookie = unlockCookie(check);
  if (!cookie) return authorityError(locale, "unavailable", 503);
  const allowance = await consumeDailyLimit(`${AUTHORITY_SLUG}-unlock`, ip, UNLOCKS_PER_IP_PER_DAY);
  if (!allowance.ok) {
    return authorityError(locale, allowance.reason === "rate_limited" ? "rate_limited" : "unavailable", allowance.reason === "rate_limited" ? 429 : 503);
  }

  if (parsed.success && !isBlockedCountry(cfCountry(request.headers))) {
    try {
      await recordAuthorityLead({
        check,
        email: parsed.data.email,
        locale: authorityLocale(parsed.data.locale) === "fr" ? "fr" : "en",
        consent: parsed.data.consent === true,
      });
    } catch (err) {
      // The visitor still gets what they asked for; the lost lead is logged.
      logger.warn({ err, token }, "authority checker: lead not stored");
    }
  }

  const headers = { "set-cookie": cookie };
  let notice: "budget" | "upstream" | null = null;
  let view = toView(check, true);
  try {
    const out = await ensureFull(check);
    if (out.state === "ok") {
      if (out.check !== check) await saveCheck(out.check);
      view = toView(out.check, true);
    } else {
      notice = "budget";
    }
  } catch (err) {
    logger.error({ err, token }, "authority checker: full section purchase failed");
    notice = "upstream";
  }
  return authorityJson({ ...view, notice }, { headers });
}

// POST /api/seo/v1/link-authority/pdf — the Link Authority report as a PDF,
// for a paying workspace (2026-11-10). Body: { domain, competitors?, checkedAt?,
// locale? }, the check the page just showed.
//
// Same guard as the check (gate.ts). The numbers are rebuilt from the 7-day
// domain cache only (cachedLinkAuthorityReport): the PDF buys nothing and uses
// no allowance, so it cannot be used to get a check for free — a domain that
// is not in cache answers 410 "run the check again". The sidecar renders it
// with `paid: true`: no "Partial view" band, no CTA.
//
// AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.

import { z } from "zod";
import { logger } from "@/infrastructure/observability/logger";
import { MAX_COMPETITORS } from "@/lib/authority-checker/config";
import { normalizeCheck } from "@/lib/authority-checker/domains";
import { linkAuthorityMember } from "@/lib/authority-checker/gate";
import { authorityError } from "@/lib/authority-checker/http";
import { pdfCheckedAt, pdfFilename, renderAuthorityPdf } from "@/lib/authority-checker/pdf";
import { cachedLinkAuthorityReport } from "@/lib/authority-checker/service";
import { rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  domain: z.string().max(300),
  competitors: z.array(z.string().max(300)).max(MAX_COMPETITORS * 2).optional(),
  checkedAt: z.string().max(40).optional(),
  locale: z.string().max(10).optional(),
});

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  const locale = parsed.success ? parsed.data.locale : undefined;

  const gate = await linkAuthorityMember(locale);
  if (!gate.ok) return gate.res;
  const { m } = gate;

  if (!parsed.success) return authorityError(locale, "invalid_domain", 400);
  const input = normalizeCheck(parsed.data);
  if (!input.ok) return authorityError(locale, input.error, 400);

  const limited = await rateLimit(`link-authority-pdf:${m.tenantId}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.success) return authorityError(locale, "unavailable", 429);

  const report = await cachedLinkAuthorityReport(input, pdfCheckedAt(parsed.data.checkedAt));
  if (!report) return authorityError(locale, "expired", 410);

  try {
    const pdf = await renderAuthorityPdf(report, locale);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(report.domain)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ err, tenantId: m.tenantId, domain: report.domain }, "link authority: PDF failed");
    return authorityError(locale, "pdf_failed", 503);
  }
}

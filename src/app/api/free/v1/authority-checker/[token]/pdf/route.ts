// GET /api/free/v1/authority-checker/{token}/pdf?locale= — the unlocked report
// as a PDF, for the browser that unlocked it (erac_<token>); 403 otherwise,
// 409 while the full section is still pending. Spends nothing upstream.

import { logger } from "@/infrastructure/observability/logger";
import { loadCheck, requestUnlocked } from "@/lib/authority-checker/store";
import { pdfFilename, renderAuthorityPdf } from "@/lib/authority-checker/pdf";
import { authorityError } from "@/lib/authority-checker/http";
import { getCurrentTenant } from "@/lib/tenant";
import { saveReportCopy } from "@/lib/report-archive";

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const locale = new URL(request.url).searchParams.get("locale");
  const check = await loadCheck(token);
  if (!check) return authorityError(locale, "not_found", 404);
  if (!requestUnlocked(request, token)) return authorityError(locale, "invalid_email", 403);
  if (!check.full) return authorityError(locale, "budget", 409);
  try {
    const pdf = await renderAuthorityPdf(check, locale);
    // The report archive, for a signed-in visitor only (a free-tool PDF of an
    // anonymous visitor has no workspace to belong to). Never fails the download.
    const member = await getCurrentTenant().catch(() => null);
    if (member) void saveReportCopy({ tenantId: member.tenantId, type: "authority-checker", ext: "pdf", contentType: "application/pdf", body: new Uint8Array(pdf) });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${pdfFilename(check.domain)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    logger.error({ err, token }, "authority checker: PDF render failed");
    return authorityError(locale, "unavailable", 503);
  }
}

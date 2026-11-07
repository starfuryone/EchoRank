// GET /api/free/v1/authority-checker/{token} — a stored check: the free view,
// plus the full section for a browser that unlocked it (erac_<token> cookie).
// Free: reads Redis only, never DataForSEO.

import { loadCheck, requestUnlocked, toView } from "@/lib/authority-checker/store";
import { authorityError, authorityJson } from "@/lib/authority-checker/http";

export async function GET(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const locale = new URL(request.url).searchParams.get("locale");
  const check = await loadCheck(token);
  if (!check) return authorityError(locale, "not_found", 404);
  return authorityJson(toView(check, requestUnlocked(request, token)));
}

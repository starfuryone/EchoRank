import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { AiLensClient } from "@/components/seo-tools/ai-lens-client";

// AI Lens — what AI answer engines actually see on a page. The sidecar fetches
// the URL twice (raw HTTP as GPTBot, then headless chromium) and diffs the two
// markdown renderings; POST /api/seo/v1/ai-lens/analyze is synchronous and takes
// ~15-20 s because of the render.
//
// Paid gating enforced by ../layout.tsx. The own-domain rule (cross-domain is
// AGENCY+) is enforced in the analyze route, not here.
export default async function AiLensPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <AiLensClient locale={locale} />;
}

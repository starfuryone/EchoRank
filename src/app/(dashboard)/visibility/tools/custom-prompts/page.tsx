import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { CustomPromptsClient } from "@/components/seo-tools/custom-prompts-client";

// Tracked prompts, previously the #prompts section of /visibility. The hub
// card pointed at that anchor, which is why it was the one "tool" in the grid
// that scrolled you into the middle of another page. Paid gating enforced by
// ../layout.tsx; the AGENCY+ answer_tracking gate stays in the components and
// in /api/ai/visibility/prompts.
export default async function CustomPromptsPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  return <CustomPromptsClient locale={locale} />;
}

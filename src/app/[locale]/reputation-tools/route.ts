import { landingHtml } from "./landing-html";
import { withThemeSchedule } from "@/lib/theme-schedule";
import { withCompanyLine } from "@/lib/brand/company";
import { withReputationToolsNumbers } from "./prices";

export const dynamic = "force-static";

export async function GET() {
  // Prices and location caps from PLAN_CONFIGS (./prices.ts); the payload carries tokens.
  return new Response(withCompanyLine(withThemeSchedule(withReputationToolsNumbers(landingHtml))), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

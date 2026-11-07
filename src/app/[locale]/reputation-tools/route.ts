import { landingHtml } from "./landing-html";
import { withThemeSchedule } from "@/lib/theme-schedule";
import { withCompanyLine } from "@/lib/brand/company";

export const dynamic = "force-static";

export async function GET() {
  return new Response(withCompanyLine(withThemeSchedule(landingHtml)), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

import { KEYWORD_GUIDE_HTML } from "./landing-html";
import { withThemeSchedule } from "@/lib/theme-schedule";
import { withCompanyLine } from "@/lib/brand/company";

export const dynamic = "force-static";

export function GET() {
  return new Response(withCompanyLine(withThemeSchedule(KEYWORD_GUIDE_HTML)), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

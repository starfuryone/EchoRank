import { GLOSSARY_HTML } from "./landing-html";
import { withThemeSchedule } from "@/lib/theme-schedule";
import { withCompanyLine } from "@/lib/brand/company";

export const dynamic = "force-static";

export function GET() {
  return new Response(withCompanyLine(withThemeSchedule(GLOSSARY_HTML)), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

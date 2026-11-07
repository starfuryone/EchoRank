import { issueLibraryHtml } from "./library-html";
import { withThemeSchedule } from "@/lib/theme-schedule";
import { withCompanyLine } from "@/lib/brand/company";

// Built once per deploy from the rule registry; nothing in it varies by
// request. Cloudflare → Purge Everything after a deploy that adds rules.
export const dynamic = "force-static";

export function GET() {
  return new Response(withCompanyLine(withThemeSchedule(issueLibraryHtml())), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

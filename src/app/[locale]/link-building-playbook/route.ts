import { PLAYBOOK_HTML } from "./landing-html";
import { withThemeSchedule } from "@/lib/theme-schedule";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(withThemeSchedule(PLAYBOOK_HTML), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Same policy as /methodology: long edge cache, CF Purge Everything is
      // the deploy for edits.
      "Cache-Control": "public, s-maxage=31536000",
    },
  });
}

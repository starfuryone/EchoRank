import { landingHtml } from "./landing-html";
import { withThemeSchedule } from "@/lib/theme-schedule";

export const dynamic = "force-static";

export async function GET() {
  return new Response(withThemeSchedule(landingHtml), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

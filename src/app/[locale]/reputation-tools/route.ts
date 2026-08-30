import { landingHtml } from "./landing-html";

export const dynamic = "force-static";

export async function GET() {
  return new Response(landingHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

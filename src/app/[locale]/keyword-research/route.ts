import { KEYWORD_GUIDE_HTML } from "./landing-html";

export const dynamic = "force-static";

export function GET() {
  return new Response(KEYWORD_GUIDE_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

import { LEXICON_HTML } from "./landing-html";

export const dynamic = "force-static";

export function GET() {
  return new Response(LEXICON_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

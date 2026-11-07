import { enterpriseHtml } from "./landing-html";

export const dynamic = "force-static";

export function GET() {
  return new Response(enterpriseHtml(), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short edge cache: the page is new and its links will move.
      "cache-control": "public, max-age=300",
    },
  });
}

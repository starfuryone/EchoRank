import { AIDO_HTML } from "./landing-html";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(AIDO_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Same policy as /methodology and /link-building-playbook: long edge
      // cache, CF Purge Everything is the deploy for edits.
      "Cache-Control": "public, s-maxage=31536000",
    },
  });
}

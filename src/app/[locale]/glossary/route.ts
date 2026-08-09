import { GLOSSARY_HTML } from "./landing-html";

export const dynamic = "force-static";

export function GET() {
  return new Response(GLOSSARY_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

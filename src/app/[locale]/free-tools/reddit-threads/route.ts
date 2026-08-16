// The Reddit Threads Finder was retired on 2026-08-16. Its slug had been in
// the sitemap under all five locales, so the path stays alive as a 301 onto
// the hub rather than becoming a 404 for everything that already links to it.
//
// Same shape as src/app/[locale]/lexicon/route.ts, which does this for the old
// /lexicon → /glossary rename. A route.ts here replaces the deleted page.tsx —
// the two cannot coexist in one segment.

import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ locale: string }> }
) {
  const { locale } = await ctx.params;
  permanentRedirect(`/${locale}/free-tools`);
}

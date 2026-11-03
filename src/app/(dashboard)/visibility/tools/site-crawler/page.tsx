import { permanentRedirect } from "next/navigation";

// The crawler moved to /crawler when it got its sub-brand (CRAWLER_BRAND) — its own sidebar row,
// route and header. Bookmarks, emails and research-log links still point here,
// so this 308s them across with the query string intact.
export default async function OldSiteCrawlerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, v);
  }
  const query = params.toString();
  permanentRedirect(query ? `/crawler?${query}` : "/crawler");
}

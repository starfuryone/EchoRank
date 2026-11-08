// src/lib/reddit-threads/parse.ts — pure: a DataForSEO Google organic (live,
// advanced) result → the Reddit threads it lists. Dependency-free.
//
// Only what Google already shows is kept: title, the subreddit (read from the
// URL), Google's snippet, the position, and the date when Google prints one.
// Nothing is fetched from reddit.com.
//
// THE DISCUSSIONS AND FORUMS BLOCK is read only when it is in this same
// response (it costs nothing extra then). Google seldom shows it on a
// site:reddit.com query; when it does, its Reddit links not already listed
// are appended, marked `fromForums`.

import { MAX_THREADS } from "./config";

export interface RedditThread {
  title: string;
  url: string;
  subreddit: string | null;
  snippet: string | null;
  /** Google's organic position (rank_group); null for a forums-block entry. */
  position: number | null;
  /** YYYY-MM-DD when Google shows a date, else null. */
  date: string | null;
  fromForums: boolean;
}

const REDDIT_HOST = /^(?:[a-z0-9-]+\.)?reddit\.com$/i;

/** "r/<name>" from a Reddit URL, or null (a user page, the home page, another host). */
export function subredditFromUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!REDDIT_HOST.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/r\/([A-Za-z0-9_]{2,32})(?:\/|$)/);
  return m ? `r/${m[1]}` : null;
}

/** A Reddit URL Google listed (any reddit.com host, https). */
export function isRedditUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (u.protocol === "https:" || u.protocol === "http:") && REDDIT_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** "2024-02-10 00:00:00 +00:00" → "2024-02-10"; anything else → null. */
export function dateOf(ts: unknown): string | null {
  if (typeof ts !== "string") return null;
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

interface SerpItem {
  type?: string;
  rank_group?: number;
  title?: string | null;
  url?: string | null;
  description?: string | null;
  timestamp?: string | null;
  items?: SerpItem[] | null;
}

/** The threads in one result, organic first (by position), up to MAX_THREADS organic. */
export function parseRedditSerp(result: { items?: SerpItem[] | null }[] | undefined | null): { threads: RedditThread[]; forumsBlock: boolean } {
  const items = result?.[0]?.items ?? [];
  const seen = new Set<string>();
  const threads: RedditThread[] = [];

  const organic = items
    .filter((i) => i?.type === "organic" && typeof i.url === "string" && isRedditUrl(i.url))
    .sort((a, b) => (a.rank_group ?? 99) - (b.rank_group ?? 99))
    .slice(0, MAX_THREADS);
  for (const i of organic) {
    const url = i.url!;
    if (seen.has(url)) continue;
    seen.add(url);
    threads.push({
      title: text(i.title, 300) ?? url,
      url,
      subreddit: subredditFromUrl(url),
      snippet: text(i.description, 500),
      position: typeof i.rank_group === "number" ? i.rank_group : null,
      date: dateOf(i.timestamp),
      fromForums: false,
    });
  }

  const forums = items.filter((i) => i?.type === "discussions_and_forums");
  for (const block of forums) {
    for (const e of block.items ?? []) {
      if (typeof e?.url !== "string" || !isRedditUrl(e.url) || seen.has(e.url)) continue;
      seen.add(e.url);
      threads.push({
        title: text(e.title, 300) ?? e.url,
        url: e.url,
        subreddit: subredditFromUrl(e.url),
        snippet: text(e.description, 500),
        position: null,
        date: dateOf(e.timestamp),
        fromForums: true,
      });
    }
  }
  return { threads, forumsBlock: forums.length > 0 };
}

/** RFC 4180 CSV of the threads (the email-gated export). */
export function threadsCsv(threads: RedditThread[]): string {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // A leading = + - @ would run as a formula in a spreadsheet.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [["position", "title", "subreddit", "date", "url", "snippet"]];
  for (const t of threads) rows.push([t.position === null ? "" : String(t.position), t.title, t.subreddit ?? "", t.date ?? "", t.url, t.snippet ?? ""]);
  return rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

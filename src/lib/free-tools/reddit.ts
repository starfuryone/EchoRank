// src/lib/free-tools/reddit.ts
//
// Reddit public search, proxied server-side.
//
// WHY A PROXY AND NOT A BROWSER FETCH. Reddit does not send CORS headers for
// search.json, so the browser cannot read it; and a client fetch would expose
// visitors' IPs to Reddit rather than ours. Server-side also means one cache
// serves everyone asking the same keyword.
//
// REDDIT REFUSES ANONYMOUS TRAFFIC READILY. 403 and 429 are routine, not
// exceptional, so they are modelled as ordinary outcomes rather than thrown:
// the route turns them into "try again later" and REFUNDS the visitor's
// allowance, because we did not deliver anything.

/** Identifies us and gives Reddit somewhere to complain. Their rules ask for it. */
const REDDIT_USER_AGENT =
  "web:com.echorank360.free-tools:v1.0 (+https://echorank360.com/bot)";

const REDDIT_TIMEOUT_MS = 8_000;
const MAX_RESULTS = 25;

export interface RedditThread {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  comments: number;
  /** Seconds since the post was created, at fetch time. */
  ageSeconds: number;
  permalink: string;
  author: string;
  isSelf: boolean;
}

export type RedditOutcome =
  | { status: "ok"; threads: RedditThread[] }
  /** Reddit answered, but with a refusal or nothing usable. */
  | { status: "blocked"; httpStatus: number | null };

interface RedditChild {
  data?: {
    id?: unknown;
    title?: unknown;
    subreddit?: unknown;
    score?: unknown;
    num_comments?: unknown;
    created_utc?: unknown;
    permalink?: unknown;
    author?: unknown;
    is_self?: unknown;
    stickied?: unknown;
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Map Reddit's payload onto the fields the card renders, dropping the rest. */
export function parseRedditSearch(body: unknown, now: Date = new Date()): RedditThread[] {
  const children = (body as { data?: { children?: RedditChild[] } })?.data?.children;
  if (!Array.isArray(children)) return [];

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const threads: RedditThread[] = [];

  for (const child of children) {
    const d = child?.data;
    if (!d) continue;
    const title = str(d.title);
    const permalink = str(d.permalink);
    if (!title || !permalink) continue;
    // Stickied posts are subreddit furniture, not discussion of the keyword.
    if (d.stickied === true) continue;

    threads.push({
      id: str(d.id) || permalink,
      title,
      subreddit: str(d.subreddit),
      score: num(d.score),
      comments: num(d.num_comments),
      ageSeconds: Math.max(0, nowSeconds - num(d.created_utc)),
      permalink: `https://www.reddit.com${permalink}`,
      author: str(d.author),
      isSelf: d.is_self === true,
    });

    if (threads.length >= MAX_RESULTS) break;
  }

  return threads;
}

/**
 * Search Reddit for a keyword.
 *
 * Never throws: a timeout, a refusal and malformed JSON all come back as
 * "blocked", so the route can tell the visitor something true and give their
 * allowance back.
 */
export async function searchReddit(
  keyword: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RedditOutcome> {
  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", keyword);
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", String(MAX_RESULTS));
  // Reddit serves an interstitial to logged-out clients without this.
  url.searchParams.set("raw_json", "1");

  try {
    const res = await fetchImpl(url.toString(), {
      headers: { "user-agent": REDDIT_USER_AGENT, accept: "application/json" },
      signal: AbortSignal.timeout(REDDIT_TIMEOUT_MS),
    });

    if (!res.ok) return { status: "blocked", httpStatus: res.status };

    const body = await res.json().catch(() => null);
    if (!body) return { status: "blocked", httpStatus: res.status };

    return { status: "ok", threads: parseRedditSearch(body) };
  } catch {
    return { status: "blocked", httpStatus: null };
  }
}

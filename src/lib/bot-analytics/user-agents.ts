// src/lib/bot-analytics/user-agents.ts
//
// The exact User-Agent string each crawler sends, for the ACTIVE ACCESS CHECK.
//
// Why this file exists at all: robots.txt tells you what a site *says*. It says
// nothing about what the edge actually *does*. A site can publish
// "User-agent: * / Allow: /" and still have Cloudflare, a WAF rule, or a bot-
// fighting product return 403 to GPTBot on every request. robots.txt-only
// reporting calls that site open to ChatGPT. It is not. The only way to know is
// to ask for the page as the bot and look at the status line.
//
// TWO TOKENS DELIBERATELY HAVE NO USER AGENT.
// `Google-Extended` and `Applebot-Extended` are robots.txt *preference tokens*,
// not crawlers — no HTTP client ever sends them. Google-Extended governs whether
// Gemini may train on content already fetched by Googlebot; Applebot-Extended
// does the same for Apple Intelligence over Applebot's fetches. Probing them
// would mean inventing a User-Agent nobody sends and reporting the result as if
// it meant something. They are marked `probeable: false` and their verdict comes
// from robots.txt alone, which for them is the whole truth.
//
// Strings are the published ones from each operator's own documentation. They
// are matched by real WAF rules, so a paraphrase changes the answer — do not
// "tidy" them.

/** A bot we can actually send a request as. */
export interface ProbeableBot {
  token: string;
  probeable: true;
  userAgent: string;
}

/** A robots.txt-only preference token. Nothing fetches as this. */
export interface PreferenceBot {
  token: string;
  probeable: false;
  /** Why it cannot be probed — surfaced in the UI, not just a code comment. */
  reason: "preference_token";
}

export type BotProbeSpec = ProbeableBot | PreferenceBot;

const p = (token: string, userAgent: string): ProbeableBot => ({
  token,
  probeable: true,
  userAgent,
});

const pref = (token: string): PreferenceBot => ({
  token,
  probeable: false,
  reason: "preference_token",
});

/**
 * Keyed by the same tokens as BOT_CATALOG, so the two stay in lockstep; the
 * test asserts every catalog token has a spec here and vice versa.
 */
export const BOT_PROBE_SPECS: Record<string, BotProbeSpec> = {
  Googlebot: p(
    "Googlebot",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ),
  Bingbot: p(
    "Bingbot",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  ),
  GPTBot: p(
    "GPTBot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
  ),
  "OAI-SearchBot": p(
    "OAI-SearchBot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
  ),
  ClaudeBot: p(
    "ClaudeBot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  ),
  // Legacy Anthropic token. Sent bare by the old crawler; some WAFs still
  // pattern-match it, which is exactly why it is worth probing separately.
  "anthropic-ai": p("anthropic-ai", "anthropic-ai"),
  PerplexityBot: p(
    "PerplexityBot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  ),
  CCBot: p("CCBot", "CCBot/2.0 (https://commoncrawl.org/faq/)"),
  Bytespider: p(
    "Bytespider",
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  ),
  Amazonbot: p(
    "Amazonbot",
    "Mozilla/5.0 (Linux; like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Amazonbot/0.1 Mobile Safari/537.36",
  ),
  // Meta's AI crawler, added after this tool first shipped. It is a real
  // fetching crawler (unlike the two -Extended tokens below), so it is probed.
  "meta-externalagent": p(
    "meta-externalagent",
    "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  ),
  "Google-Extended": pref("Google-Extended"),
  "Applebot-Extended": pref("Applebot-Extended"),
};

/** Tokens the active check actually sends a request for. */
export const PROBEABLE_TOKENS: string[] = Object.values(BOT_PROBE_SPECS)
  .filter((s): s is ProbeableBot => s.probeable)
  .map((s) => s.token);

export function probeSpec(token: string): BotProbeSpec | undefined {
  return BOT_PROBE_SPECS[token];
}

/**
 * Probe pacing. Sequential and slow on purpose: this fires a dozen requests at
 * a customer's origin, and doing it in parallel looks like exactly the traffic
 * pattern the WAF we are trying to measure exists to block. One request per
 * second, ten-second ceiling each, is both polite and slower than any
 * reasonable timeout on the caller.
 */
export const PROBE_DELAY_MS = 1_000;
export const PROBE_TIMEOUT_MS = 10_000;

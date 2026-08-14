// src/lib/attribution/sources.ts
//
// THE LIST. Data, not code.
//
// This file is the single place a new AI assistant gets added, and adding one
// should be a one-line edit to an array below — never a change to a branch in
// classify.ts. The matching engine lives next door in classify.ts and knows
// nothing about any particular assistant; if you find yourself wanting to add
// an `if (source === "…")` there, the rule shape here is missing something and
// that is the thing to fix.
//
// The list is duplicated into the browser snippet (attribution.js) so a visit
// can be classified before the beacon is sent, but that copy is a HINT ONLY.
// The server re-classifies every payload from this module and stores its own
// answer — see classify.ts. A visitor who edits the beacon body cannot choose
// their own source.

/** Persisted enum. Mirrors `AiVisitSource` in schema.prisma exactly. */
export const AI_VISIT_SOURCES = [
  "chatgpt",
  "perplexity",
  "gemini",
  "copilot",
  "claude",
  "dark_ai",
] as const;

export type AiVisitSource = (typeof AI_VISIT_SOURCES)[number];

/** The five named assistants. `dark_ai` is a residual, never a rule target. */
export type NamedAiSource = Exclude<AiVisitSource, "dark_ai">;

export interface SourceRule {
  source: NamedAiSource;
  /**
   * Referrer hostnames. Matched as the host itself OR any subdomain of it
   * ("openai.com" matches "chat.openai.com"), after stripping a leading "www.".
   */
  hosts: string[];
  /**
   * utm_source / utm_medium / ref / source query values, lowercased and matched
   * whole. These are what an assistant appends when it decorates outbound links,
   * and what a customer hand-tags a campaign with.
   */
  markers: string[];
  /**
   * Hosts that serve BOTH an AI assistant and something that is not one, so the
   * host alone proves nothing and the referrer path has to decide.
   *
   * Each entry pairs a host with the path prefixes that mean "assistant". A
   * referrer on that host whose path is absent or does not match is NOT this
   * source, and falls through the rest of the list — which for bing.com means it
   * ends up classified as no AI source at all, which is correct: an ordinary
   * Bing search is ordinary search traffic.
   */
  ambiguousHosts?: { host: string; aiPathPrefixes: string[] }[];
}

/**
 * Named-source rules, evaluated in order. Order only matters where two rules
 * could match the same referrer; today none do.
 */
export const SOURCE_RULES: SourceRule[] = [
  {
    source: "chatgpt",
    hosts: ["chatgpt.com", "chat.openai.com", "openai.com"],
    markers: ["chatgpt", "chatgpt.com", "chat.openai.com", "openai", "gptbot"],
  },
  {
    source: "perplexity",
    hosts: ["perplexity.ai", "pplx.ai"],
    markers: ["perplexity", "perplexity.ai", "pplx"],
  },
  {
    source: "gemini",
    hosts: ["gemini.google.com", "bard.google.com", "aistudio.google.com"],
    markers: ["gemini", "google-gemini", "bard"],
  },
  {
    source: "copilot",
    // NOTE: bing.com is deliberately NOT in `hosts`. See ambiguousHosts below —
    // putting it there would relabel every organic Bing click as an AI referral,
    // which is the single most expensive mistake this file can make.
    hosts: ["copilot.microsoft.com", "edgeservices.bing.com", "m365.cloud.microsoft"],
    markers: ["copilot", "bingchat", "bing-chat", "microsoft-copilot"],
    ambiguousHosts: [
      {
        host: "bing.com",
        // /chat is the conversational surface. /search is ordinary Bing unless
        // it carries the conversation flag, which lives in the query string and
        // is handled by the query check in classify.ts rather than here.
        aiPathPrefixes: ["/chat", "/copilotsearch"],
      },
    ],
  },
  {
    source: "claude",
    hosts: ["claude.ai", "claude.com"],
    markers: ["claude", "claude.ai", "anthropic", "claudebot"],
  },
];

/**
 * Query flags on an otherwise ambiguous host that prove the conversational
 * surface. Checked only for the host they are listed against.
 *
 * Bing's chat answers link out with `showconv=1`; a plain SERP click does not
 * carry it.
 */
export const AMBIGUOUS_HOST_QUERY_FLAGS: Record<string, { source: NamedAiSource; params: string[] }> = {
  "bing.com": { source: "copilot", params: ["showconv", "sendquery"] },
};

/**
 * Assistants we can prove are AI but deliberately do not give their own enum
 * value. A visit from one of these is real AI traffic and is stored as
 * `dark_ai` — "an assistant, not one of the five we report on individually".
 *
 * Promoting one of these to its own source is: add a rule above, delete the
 * line here, add the enum value in schema.prisma. Until a source earns a column
 * in the UI it belongs here, where it still gets counted.
 */
export const OTHER_AI_HOSTS: string[] = [
  "you.com",
  "poe.com",
  "phind.com",
  "andisearch.com",
  "meta.ai",
  "x.ai",
  "grok.com",
  "chat.mistral.ai",
  "chat.deepseek.com",
  "huggingface.co",
  "kagi.com",
  "arc.net",
  "komo.ai",
  "iask.ai",
];

/** utm/ref markers with the same meaning as OTHER_AI_HOSTS. */
export const OTHER_AI_MARKERS: string[] = [
  "ai",
  "ai-search",
  "ai_search",
  "aisearch",
  "llm",
  "chatbot",
  "you.com",
  "poe",
  "phind",
  "meta-ai",
  "grok",
  "mistral",
  "lechat",
  "deepseek",
  "kagi",
];

/**
 * Query parameters read for a marker, in precedence order. `utm_source` first
 * because it is the one an assistant actually sets; the rest are what customers
 * hand-tag with.
 */
export const MARKER_PARAMS = ["utm_source", "ref", "source", "utm_medium"] as const;

/** UTM keys captured verbatim onto the visit row. */
export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type UtmParam = (typeof UTM_PARAMS)[number];

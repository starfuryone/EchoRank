// Marketing Studio — the 12 brief templates, as one typed config.
//
// Same pattern as seo-tools.ts: this file is the single source. A category's
// prompt text lives here and NOWHERE else — in particular the API route
// assembles the prompt from this config and never accepts prompt text from the
// client, so a caller cannot inject their own instructions.
//
// COST DOCTRINE. Heuristics wherever the work is deterministic; the model only
// where judgement is genuinely needed:
//   heuristic — no API call at all (08 brand voice)
//   hybrid    — heuristic result, plus ONE optional model call the user asks
//               for by pressing a button (05 social, 09 analytics, 12 VoC)
//   generate  — the model writes the deliverable (the other eight)
// The pasted-data variables (writing samples, analytics rows, raw feedback) are
// analysed in TypeScript and are NEVER sent to the API. The hybrid AI steps
// receive the computed summary — top phrases, a schedule, a delta table — not
// the corpus that produced it.
//
// Template text is English in v1 regardless of UI locale: these are prompts,
// and translating them costs generation quality. The route appends a
// "respond in <language>" line for fr/fr-CA/de-CH instead.

/** The only model this module uses. Haiku, everywhere, deliberately. */
export const MARKETING_MODEL = "claude-haiku-4-5";

/**
 * Prompt caching does NOT engage for this module and that is expected.
 *
 * The minimum cacheable prefix is model-dependent, and for claude-haiku-4-5 it
 * is 4096 tokens — the audit block, the global rules and a template come to
 * roughly 500. Below the minimum the API accepts `cache_control` and silently
 * declines to cache: no error, and `cache_creation_input_tokens` stays 0.
 *
 * The system blocks are still ordered most-shared-first (audit → template →
 * voice) because that is the correct shape if this ever moves to a model with a
 * lower minimum, and because it keeps the variable values isolated in the user
 * message where they belong. Do not "fix" the absent cache hits by padding the
 * prefix to 4096 tokens — that pays to process filler in order to discount
 * filler. The Redis result cache is the real saving here: an exact repeat costs
 * nothing at all, which beats a 90% discount.
 */
export const HAIKU_MIN_CACHEABLE_PREFIX_TOKENS = 4096;

/** Verbatim, and prepended to every generation. */
export const AUDIT_INSTRUCTION =
  "Before reporting any deliverable as finished, audit it against the actual brief. " +
  "Confirm it hits the specific goal, the specific audience, and the specific format requested. " +
  "If something is uncertain or you made an assumption, state it explicitly rather than " +
  "presenting it as settled.";

export type MarketingMode = "generate" | "heuristic" | "hybrid";

export interface MarketingVariable {
  /** Placeholder name; appears as {KEY} in the template text. */
  k: string;
  /** i18n key for the field label (dashboard catalog: en / fr / de-CH). */
  labelKey: string;
  /** Textarea rather than input. Set for pasted-data fields. */
  multiline?: boolean;
}

export type MarketingPart = string | MarketingVariable;

export interface MarketingCategory {
  id: string;
  num: string;
  nameKey: string;
  roleKey: string;
  mode: MarketingMode;
  /** Output ceiling for the generate step, or a hybrid's optional AI step. */
  maxTokens?: number;
  parts: MarketingPart[];
}

const v = (k: string, labelKey: string, multiline = false): MarketingVariable =>
  multiline ? { k, labelKey, multiline } : { k, labelKey };

export const MARKETING_CATEGORIES: MarketingCategory[] = [
  {
    id: "positioning",
    num: "01",
    nameKey: "marketing.positioning.name",
    roleKey: "marketing.positioning.role",
    mode: "generate",
    maxTokens: 1500,
    parts: [
      "I sell ",
      v("PRODUCT", "marketing.var.product"),
      " to ",
      v("AUDIENCE", "marketing.var.audience"),
      ". Our main competitor is ",
      v("COMPETITOR", "marketing.var.competitor"),
      " and they position around ",
      v("THEIR_ANGLE", "marketing.var.theirAngle"),
      ".\nGenerate 5 distinct positioning angles for us that are NOT the same angle our competitor uses. " +
        "For each one: the one-sentence positioning statement, who it resonates with most, and the biggest " +
        "objection it will face.\nRank them by how defensible they are against a competitor copying us in 6 months.",
    ],
  },
  {
    id: "ads",
    num: "02",
    nameKey: "marketing.ads.name",
    roleKey: "marketing.ads.role",
    mode: "generate",
    maxTokens: 1500,
    parts: [
      "Write 10 ad variations for ",
      v("PRODUCT", "marketing.var.product"),
      " targeting ",
      v("AUDIENCE", "marketing.var.audience"),
      " on ",
      v("PLATFORM", "marketing.var.platform"),
      ".\nEach variation should use a DIFFERENT angle: pain point, aspiration, social proof, urgency, " +
        "curiosity, contrarian take, question hook, statistic hook, story hook, direct offer.\nKeep each under ",
      v("CHARACTER_LIMIT", "marketing.var.characterLimit"),
      " characters. No AI cliches. No exclamation point stacking. One clear CTA per ad.\n" +
        "After generating all 10, tell me which 3 you would test first and why.",
    ],
  },
  {
    id: "email",
    num: "03",
    nameKey: "marketing.email.name",
    roleKey: "marketing.email.role",
    mode: "generate",
    // Longer ceiling: a sequence is N emails, each with subject, preview and body.
    maxTokens: 2500,
    parts: [
      "Write a ",
      v("NUMBER", "marketing.var.number"),
      "-email welcome sequence for new subscribers to ",
      v("BUSINESS", "marketing.var.business"),
      ". Goal of the sequence: ",
      v("GOAL", "marketing.var.goal"),
      ".\nEmail 1 should deliver value with zero ask. Space escalating asks across the remaining emails. " +
        "Include subject line, preview text, and body for each.\nFlag which email is most likely to get the " +
        "highest open rate and why.",
    ],
  },
  {
    id: "seo",
    num: "04",
    nameKey: "marketing.seo.name",
    roleKey: "marketing.seo.role",
    mode: "generate",
    maxTokens: 1500,
    parts: [
      "Build a content cluster around the seed keyword ",
      v("KEYWORD", "marketing.var.keyword"),
      " for ",
      v("BUSINESS", "marketing.var.business"),
      ". Identify the 8 to 10 subtopics that should each get their own article, the search intent behind " +
        "each one, and the internal linking structure that ties them back to ",
      v("CONVERSION_PAGE", "marketing.var.conversionPage"),
      ".\nFor each subtopic, give me a working headline and a one-sentence summary of the unique angle, " +
        "not just a rehash of what already ranks.",
    ],
  },
  {
    id: "social",
    num: "05",
    nameKey: "marketing.social.name",
    roleKey: "marketing.social.role",
    // The grid, the pillar rotation and the format cycle are scheduling logic,
    // not judgement. One model call writes the hooks and nothing else.
    mode: "hybrid",
    maxTokens: 1000,
    parts: [
      "For a ",
      v("PLATFORM", "marketing.var.platform"),
      " content calendar for ",
      v("BUSINESS", "marketing.var.business"),
      " over ",
      v("DAYS", "marketing.var.days"),
      " days, with content pillars ",
      v("PILLAR_1", "marketing.var.pillar1"),
      ", ",
      v("PILLAR_2", "marketing.var.pillar2"),
      " and ",
      v("PILLAR_3", "marketing.var.pillar3"),
      ", no pillar running more than ",
      v("MAX_CONSECUTIVE", "marketing.var.maxConsecutive"),
      " days in a row: write one hook per slot in the schedule provided. Each hook under 15 words, no " +
        "hashtags, no AI cliches. Respond ONLY with a JSON array of {date, hook}. For each hook, name the " +
        "one metric the post is optimized for.",
    ],
  },
  {
    id: "landing",
    num: "06",
    nameKey: "marketing.landing.name",
    roleKey: "marketing.landing.role",
    mode: "generate",
    maxTokens: 1500,
    parts: [
      "Write a full landing page for ",
      v("OFFER", "marketing.var.offer"),
      " targeting ",
      v("AUDIENCE", "marketing.var.audience"),
      ". Structure: headline, subheadline, 3 benefit-led sections (not feature-led), social proof " +
        "placement, objection handling section, and a closing CTA block.\nAfter the draft, list the 3 " +
        "elements most likely to hurt conversion and why, and suggest an A/B test for each one.",
    ],
  },
  {
    id: "video",
    num: "07",
    nameKey: "marketing.video.name",
    roleKey: "marketing.video.role",
    mode: "generate",
    maxTokens: 1500,
    parts: [
      "Write a ",
      v("LENGTH_SECONDS", "marketing.var.lengthSeconds"),
      "-second script for ",
      v("PLATFORM", "marketing.var.platform"),
      " about ",
      v("TOPIC", "marketing.var.topic"),
      " for ",
      v("AUDIENCE", "marketing.var.audience"),
      ". Structure: hook in first 3 seconds, one core idea, one specific proof point, one clear next " +
        "step.\nInclude a shot list or visual direction alongside the spoken script, not just the words.",
    ],
  },
  {
    id: "voice",
    num: "08",
    nameKey: "marketing.voice.name",
    roleKey: "marketing.voice.role",
    // ZERO API calls. Everything below is computed from the samples in
    // TypeScript; the samples never leave this server.
    mode: "heuristic",
    parts: [v("WRITING_SAMPLES", "marketing.var.writingSamples", true)],
  },
  {
    id: "analytics",
    num: "09",
    nameKey: "marketing.analytics.name",
    roleKey: "marketing.analytics.role",
    mode: "hybrid",
    maxTokens: 600,
    parts: [
      v("DATA", "marketing.var.data", true),
      // The AI step receives the COMPUTED SUMMARY only — never these rows.
      "Here is a computed summary of my marketing data. Identify the top 3 things that are working, the " +
        "top 3 that are not, and one specific action for each finding. Do not describe the numbers back to " +
        "me. Flag anything that contradicts what I would have assumed going in.",
    ],
  },
  {
    id: "campaign",
    num: "10",
    nameKey: "marketing.campaign.name",
    roleKey: "marketing.campaign.role",
    mode: "generate",
    // Produces several assets in one pass, so it needs the higher ceiling.
    maxTokens: 2500,
    parts: [
      "Plan a complete campaign for ",
      v("CAMPAIGN_SUBJECT", "marketing.var.campaignSubject"),
      " over ",
      v("TIMEFRAME", "marketing.var.timeframe"),
      ".\nFirst, outline the plan: what assets are needed, what order they should be created in, and the " +
        "single success metric for the whole campaign. Then produce each asset (ad copy, email sequence " +
        "outline, landing page draft, social post concepts) in that order, referencing the campaign goal in " +
        "each one so everything stays aligned to the same message.\nBefore finishing, audit every asset " +
        "against the original goal and flag anything that drifted from it.",
    ],
  },
  {
    id: "outreach",
    num: "11",
    nameKey: "marketing.outreach.name",
    roleKey: "marketing.outreach.role",
    mode: "generate",
    maxTokens: 1500,
    parts: [
      "I want to partner with ",
      v("PARTNER_TYPE", "marketing.var.partnerType"),
      " for ",
      v("PARTNERSHIP_GOAL", "marketing.var.partnershipGoal"),
      ".\nWrite 5 distinct outreach message variations for cold contact, each leading with something " +
        "specific to them, not a generic pitch. Vary the angle: mutual audience fit, a specific piece of " +
        "their content I am referencing, a data point about my audience that would interest them, a " +
        "low-commitment first ask, and a direct partnership proposal.\nFlag which one you would lead with " +
        "for a first-time cold contact versus a warm follow-up.",
    ],
  },
  {
    id: "voc",
    num: "12",
    nameKey: "marketing.voc.name",
    roleKey: "marketing.voc.role",
    mode: "hybrid",
    maxTokens: 500,
    parts: [
      v("RAW_FEEDBACK", "marketing.var.rawFeedback", true),
      // The AI step receives the top phrases only — never the corpus.
      "These are the 5 most frequent phrases customers use to describe their problem. Turn each into a " +
        "headline or ad copy candidate using the customer's actual words. Keep their language, do not " +
        "corporate-wash it.",
    ],
  },
];

/** Lookup by id. Returns null for an unknown id — the route 400s on null. */
export function findMarketingCategory(id: unknown): MarketingCategory | null {
  if (typeof id !== "string") return null;
  return MARKETING_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** The variables a category declares, in template order. */
export function categoryVariables(category: MarketingCategory): MarketingVariable[] {
  return category.parts.filter((p): p is MarketingVariable => typeof p !== "string");
}

/**
 * The static template text, with variables left as {KEY} placeholders.
 *
 * This is system block 2 — static per category, identical for every tenant, so
 * it sits ahead of the per-tenant voice guide in the block order.
 */
export function templateText(category: MarketingCategory): string {
  return category.parts.map((p) => (typeof p === "string" ? p : `{${p.k}}`)).join("");
}

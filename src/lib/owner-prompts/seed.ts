// src/lib/owner-prompts/seed.ts
//
// The owner tenant's tracked prompts — the questions a buyer of either of our
// two products would actually type into an AI assistant. Data, not code: the
// runner (scripts/seed-owner-prompts.ts, `npm run prompts:seed-owner`) makes
// the tenant's ACTIVE prompts exactly this list, so the dashboard we dogfood
// is reproducible from git instead of from whatever was last typed into it
// ("best plumber in montreal" was one of two prompts before this existed).
//
// RULES FOR THE LIST
// - No prompt names either brand. A prompt that contains the answer measures
//   nothing; these ask the category question a stranger asks.
// - 25 in total: the AGENCY active-prompt cap (/api/ai/visibility/prompts).
//   tests/owner-prompts.test.ts holds both.
// - `brand` becomes the prompt's tag, which is how per-brand mention rates are
//   read back out (TrackedPrompt.tags).
//
// Dependency-free: imported by the seed script and by the test.

export type OwnerBrandKey = "echorank360" | "echopilot";

export interface OwnerBrand {
  key: OwnerBrandKey;
  /** BrandProfile.name — also a mention term for the prompt runner. */
  name: string;
  /** Other spellings that count as a mention (BrandProfile.aliases). */
  aliases: string[];
  website: string;
}

export const OWNER_BRANDS: readonly OwnerBrand[] = [
  {
    key: "echorank360",
    name: "Echorank360",
    aliases: ["Echorank", "echorank360.com"],
    website: "https://echorank360.com",
  },
  {
    key: "echopilot",
    name: "EchoPilot",
    aliases: ["Echo Pilot", "echopilotlabs.com"],
    website: "https://echopilotlabs.com",
  },
];

export const OWNER_PROMPTS: ReadonlyArray<{ brand: OwnerBrandKey; text: string }> = [
  // ── Echorank360: AI visibility + reputation (13) ──
  { brand: "echorank360", text: "What is the best AI visibility tracker for a small business?" },
  { brand: "echorank360", text: "Best reputation management software for small businesses" },
  { brand: "echorank360", text: "How do I get my business mentioned by ChatGPT?" },
  { brand: "echorank360", text: "What is a good llms.txt generator?" },
  { brand: "echorank360", text: "Best review request software for local businesses" },
  { brand: "echorank360", text: "How can I measure my share of voice in AI answers?" },
  { brand: "echorank360", text: "Which tools track AI citations of my website?" },
  { brand: "echorank360", text: "What are the best GEO tools for generative engine optimization?" },
  { brand: "echorank360", text: "What are cheaper alternatives to Birdeye?" },
  { brand: "echorank360", text: "Alternatives to Podium for review management" },
  { brand: "echorank360", text: "How do I check if my brand appears in Google AI Overviews?" },
  { brand: "echorank360", text: "Tools to monitor what ChatGPT and Perplexity say about my company" },
  { brand: "echorank360", text: "Affordable AI search visibility platform for marketing agencies" },
  // ── EchoPilot: small-business marketing audit (12) ──
  { brand: "echopilot", text: "Best small business marketing audit tool" },
  { brand: "echopilot", text: "Free website audit for a small business" },
  { brand: "echopilot", text: "What should I fix first on my small business website?" },
  { brand: "echopilot", text: "How do I audit my Google Business Profile?" },
  { brand: "echopilot", text: "Local SEO checklist for a small business" },
  { brand: "echopilot", text: "Marketing plan for a plumbing company" },
  { brand: "echopilot", text: "Marketing plan for a dental practice" },
  { brand: "echopilot", text: "Marketing plan for a small restaurant" },
  { brand: "echopilot", text: "Marketing plan for a small law firm" },
  { brand: "echopilot", text: "How can I improve my website score?" },
  { brand: "echopilot", text: "Is there an alternative to hiring an SEO consultant for a small business?" },
  { brand: "echopilot", text: "How can a small business owner audit their own website marketing?" },
];

/**
 * What the runner will do to a tenant's existing prompts — pure, so the test
 * can hold it. Seed texts are created or re-activated; every OTHER active
 * prompt is paused, not deleted, so its run history survives (pass `prune` to
 * delete them instead).
 */
export function planOwnerSeed(
  existing: ReadonlyArray<{ id: string; text: string; active: boolean }>,
  prune = false,
): { upsert: typeof OWNER_PROMPTS; pause: string[]; remove: string[] } {
  const seedTexts = new Set(OWNER_PROMPTS.map((p) => p.text));
  const others = existing.filter((p) => !seedTexts.has(p.text));
  return {
    upsert: OWNER_PROMPTS,
    pause: prune ? [] : others.filter((p) => p.active).map((p) => p.id),
    remove: prune ? others.map((p) => p.id) : [],
  };
}

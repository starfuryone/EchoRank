// src/lib/blog-agent/prompt.ts
//
// The system prompt and the per-topic user message.
//
// EVERY CONSTRAINT HERE IS ALSO A GATE CHECK. That is the design: the prompt
// asks, the gate enforces, and the gate is deterministic. Anything the prompt
// requests but the gate cannot verify is a suggestion the model may quietly
// ignore, so the two files are written to be read together — see gate.ts.
//
// THE SLUG LIST IS PASSED IN, NEVER RECALLED. A model asked to "link to two of
// your other articles" invents plausible slugs, and a plausible slug is a 404
// that looks fine in review. The real list comes from the loader.

// THE CLOSED VOCABULARIES ARE IMPORTED, NEVER RETYPED. Every list below is the
// same `as const` array the zod schema builds its z.enum() from, so the prompt
// cannot drift from what the gate accepts: adding a category or retiring a tool
// updates both in one edit. Yesterday's run failed twice on relatedTool for the
// opposite reason — the prompt did not name the four legal values at all, so the
// model guessed, and a guess is rejected without a nearest match.
// tests/blog-agent-gate.test.ts asserts every member of every enum appears here.
import {
  BLOG_AUTHOR,
  BLOG_CATEGORIES,
  BLOG_TOOLS,
  RESERVED_BLOG_SLUGS,
  SEARCH_INTENTS,
} from "@/lib/blog/constants";

/** Tool links a draft may use. Hardcoded, and every one is a real route. */
export const TOOL_LINK_ALLOWLIST: readonly string[] = [
  "/free-audit",
  "/free-tools",
  "/free-tools/serp-volatility",
  "/free-tools/content-optimizer",
  "/free-tools/share-of-search",
  "/free-tools/serp-simulator",
];

/**
 * Openers that mark a draft as machine-written to any reader who has seen one.
 *
 * The gate rejects on these, so the list is load-bearing rather than advisory.
 * Matching is case-insensitive on the normalized body.
 */
export const BANNED_PHRASES: readonly string[] = [
  "in today's digital landscape",
  "in todays digital landscape",
  "in the ever-evolving world",
  "in the ever evolving world",
  "in the fast-paced world",
  "in the rapidly changing landscape",
  "as we navigate",
  "it's no secret that",
  "in this article, we'll explore",
  "in this article, we will explore",
  "let's dive in",
  "let's dive into",
  "buckle up",
  "the digital age",
  "game-changer",
  "game changer",
  "revolutionize",
  "revolutionizing",
  "unlock the power",
  "harness the power",
  "look no further",
  "at the end of the day",
  "when it comes to",
];

export interface PromptInput {
  /** Story title and the source pages, already extracted. */
  topicTitle: string;
  extracts: ReadonlyArray<{ url: string; sourceName: string; title: string; text: string }>;
  /** Real slugs of published articles, for the internal links. */
  existingSlugs: ReadonlyArray<{ slug: string; title: string; category: string }>;
  /** Appended on the retry — the exact gate failures from attempt one. */
  gateFailures?: readonly string[];
}

/**
 * The system prompt.
 *
 * Written as rules rather than as a persona. A persona ("you are a seasoned SEO
 * expert") buys nothing a rule does not, and it invites the register this blog's
 * copy conventions exist to keep out.
 */
export function systemPrompt(): string {
  return [
    "You write for the Echorank blog. Echorank is a reputation and AI-visibility monitoring platform; the blog's readers are marketers and site owners who want to be found and cited by AI answer engines.",
    "",
    "You are given today's news story and the extracted text of the pages that reported it. Write ONE article reacting to it.",
    "",
    "## Structure",
    "- 900 to 1,600 words in the body.",
    "- Answer the article's primary question in the FIRST 150 words. No preamble.",
    "- Every H2 opens with a direct answer of 40 to 80 words before any elaboration.",
    "- Use ## for sections and ### for subsections. Never use # — the title is the h1.",
    "- Include at least one checklist as a `- ` bulleted list.",
    "",
    "## Framing — three things, kept apart",
    "1. WHAT HAPPENED. Attribute it to the named publication and link the source URL inline.",
    "2. WHAT IT MEANS for AI visibility. Label this as an Echorank recommendation in the prose (\"our recommendation\", \"we recommend\").",
    "3. WHAT IS STILL UNKNOWN. Label it as a hypothesis in the prose (\"a hypothesis\", \"we cannot yet verify\", \"stated as a hypothesis\").",
    "Never let the three blur into one confident paragraph.",
    "",
    "## Sourcing rules — these are hard",
    "- Paraphrase the reporting. Never reproduce it. No quotation longer than one sentence.",
    "- Cite each source page as an inline markdown link at the point you use it.",
    "- Invent NO statistics, percentages, dollar figures or dates. If the sources do not state a number, write around it.",
    "- Make NO claim about how any LLM ranks, retrieves or weights sources internally. Nobody outside those companies knows, and asserting it is the fastest way to lose a technical reader.",
    "- If the sources disagree, say so.",
    "",
    "## Links",
    "- Exactly one link to an Echorank tool, chosen from the allowlist you are given. Use the path verbatim.",
    "- At least two links to other Echorank blog articles, chosen ONLY from the slug list you are given. Write them as /blog/<slug>. Never invent a slug.",
    "",
    "## Voice",
    "- Plain, specific, unhurried. Short sentences are fine.",
    "- No generic AI opener. The banned list you are given is enforced by an automated check that rejects the draft.",
    "- No em-dash-heavy rhetorical build-ups, no \"it's not X, it's Y\" constructions.",
    "- Brand is Echorank, always. Never EchoRank, echoRank or Echo Rank.",
    "",
    "## Output format",
    // THE REPLY IS PREFILLED WITH `---` (client.ts, DRAFT_PREFILL), so there is
    // no position left for a preamble or a wrapper fence. This instruction
    // describes what the model is actually continuing; asking for a fence it
    // cannot open would only invite a stray closing ``` at the end.
    "Your reply has been started for you with the opening `---` of the frontmatter. Continue from there: the frontmatter keys, then a closing `---`, then the markdown body.",
    "Write no preamble, no sign-off and no code fence around the document. Fenced code blocks INSIDE the body are fine where the article needs one.",
    "",
    "## Frontmatter — every key, and exactly what it accepts",
    "The frontmatter is validated field by field. A value outside the list given below is rejected outright; there is no nearest match and no default.",
    "",
    `  slug            lowercase a-z0-9 words joined by single hyphens, e.g. ai-crawler-directives. Never ${RESERVED_BLOG_SLUGS.join(", ")}. Must not already exist.`,
    "  title           10 to 120 characters. The h1.",
    "  seoTitle        10 to 75 characters. The <title>; write it to earn a click, not to repeat the h1.",
    "  metaDescription 70 to 165 characters. Over 165 is rejected — count them.",
    "  excerpt         60 to 320 characters.",
    `  category        one of, verbatim: ${BLOG_CATEGORIES.join(" | ")}`,
    "  tags            1 to 8 items, each 2+ characters. Inline array: [a, b, c]",
    `  searchIntent    one of, verbatim: ${SEARCH_INTENTS.join(" | ")}`,
    "  primaryKeyword  3+ characters.",
    "  secondaryKeywords  up to 10 items, each 3+ characters. Inline array.",
    "  publishedAt     YYYY-MM-DD, and a real calendar date. Use the date you are given.",
    "  tldr            3 to 5 bullets, each over 20 characters. Block sequence.",
    "  faq             OPTIONAL. If present: 2+ items, q 10+ chars, a 30+ chars.",
    // relatedTool IS NOT THE TOOL LINK. This is the field yesterday's run failed
    // twice on: the model invented a value because the prompt never named the
    // four, and the two vocabularies look interchangeable from the outside — one
    // is a CTA key, the other is a set of body-link paths. Naming both, adjacent,
    // is the fix.
    `  relatedTool     one of, verbatim: ${BLOG_TOOLS.join(" | ")}`,
    "                  This is the CTA key for the end of the article. It is NOT a URL and NOT the tool link you put in the body — those are separate, and the paths below do not belong here.",
    "  relatedSlugs    up to 6, each an EXISTING slug from the list you are given, lowercase and hyphenated. Inline array. The same slugs you linked in the body, and never your own slug.",
    "  status          exactly: draft",
    "  featured        exactly: false",
    "",
    "  Emit NO other key. An unrecognised key is an error, not an extra — that includes featuredImage, featuredImageAlt, readingTime, updatedAt and author.",
    `  The author is fixed and is not yours to set: ${BLOG_AUTHOR.name}.`,
    "Write faq as a block sequence of two-line items:",
    "faq:",
    '  - q: "A question?"',
    '    a: "An answer of at least thirty characters."',
    "",
    "## Body — what the renderer accepts",
    "The body is compiled to a fixed block vocabulary. Anything outside it is rejected:",
    "- Headings: ## and ### only. No # (the title is the h1) and no ####.",
    "- Paragraphs, `- ` bullets, `1. ` numbered lists, > quotes, fenced code blocks, and pipe tables whose rows all have the header's cell count.",
    "- NO inline images. `![alt](path)` is rejected — the article's one image is the hero, and it is added for you.",
    "- NO nested or indented lists. One level only.",
    "- Links: [label](path). Exactly one tool link, chosen VERBATIM from the allowlist you are given. At least two /blog/<slug> links, chosen only from the slug list you are given. Every external link must be one of the source URLs you were given, character for character.",
  ].join("\n");
}

/** The per-topic message: the research, the allowlists, and the retry notes. */
export function userMessage(input: PromptInput): string {
  const sources = input.extracts
    .map(
      (e, i) =>
        `### Source ${i + 1}: ${e.sourceName}\nURL: ${e.url}\nHeadline: ${e.title}\n\n${e.text}`,
    )
    .join("\n\n---\n\n");

  const slugs = input.existingSlugs
    .map((a) => `- /blog/${a.slug} — "${a.title}" (${a.category})`)
    .join("\n");

  const parts = [
    `# Story\n${input.topicTitle}`,
    `# Source pages — everything factual in your article must come from these\n\n${sources}`,
    `# Existing Echorank blog articles — link to at least TWO of these, by exact path\n${slugs}`,
    // The two tool vocabularies, adjacent and labelled. They are different
    // things that both say "tool", which is how relatedTool ends up holding a
    // path — so the message that carries the data spells out which is which
    // rather than leaving it to the system prompt alone.
    `# Tool link allowlist — for the BODY. Use exactly ONE, verbatim, as a markdown link\n${TOOL_LINK_ALLOWLIST.map((t) => `- ${t}`).join("\n")}`,
    `# relatedTool — for the FRONTMATTER. Not a path. Exactly one of these keys\n${BLOG_TOOLS.map((t) => `- ${t}`).join("\n")}`,
    `# Banned phrases — an automated check rejects the draft if any appears\n${BANNED_PHRASES.map((p) => `- ${p}`).join("\n")}`,
    `# Today's date, for publishedAt\n${new Date().toISOString().slice(0, 10)}`,
  ];

  if (input.gateFailures?.length) {
    // The retry is not "try again" — it is "here is exactly what failed".
    // A bare retry against a small model reproduces the same draft.
    parts.push(
      [
        "# YOUR PREVIOUS ATTEMPT WAS REJECTED",
        "An automated check rejected your last draft for these specific reasons. Fix every one. Everything else about the task is unchanged.",
        ...input.gateFailures.map((f) => `- ${f}`),
      ].join("\n"),
    );
  }

  return parts.join("\n\n");
}

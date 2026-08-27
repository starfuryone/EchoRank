// The blog agent's quality gate.
//
// EVERY CHECK IS MUTATION-VERIFIED: a valid draft is built once, then each test
// breaks exactly one thing and asserts the gate catches it. Without the
// mutation half, a suite that only ever feeds the gate a good draft proves that
// the gate returns ok — not that any individual rule does anything.
//
// The fixture is assembled rather than pasted so the word count is a computed
// property. A hand-written 1,000-word fixture drifts below the floor the first
// time someone tidies it, and the failure reads as a gate bug.

import { describe, expect, it } from "vitest";
import {
  runGate,
  bodyWordCount,
  bodyLinks,
  brandOffenders,
  stripPreamble,
  MIN_WORDS,
  MAX_WORDS,
} from "@/lib/blog-agent/gate";
import { DRAFT_PREFILL, extractFenced, withPrefill } from "@/lib/blog-agent/client";
import { BANNED_PHRASES, TOOL_LINK_ALLOWLIST } from "@/lib/blog-agent/prompt";
import { getAllArticles } from "@/lib/blog/loader";

const PUBLISHED = getAllArticles("en");
const SLUGS = new Set(PUBLISHED.map((a) => a.slug));
const [SLUG_A, SLUG_B, SLUG_C] = PUBLISHED.map((a) => a.slug);

const SOURCE_1 = "https://searchengineland.com/example-story-12345";
const SOURCE_2 = "https://developers.google.com/search/blog/2026/08/example";
const RESEARCH_URLS = new Set([SOURCE_1, SOURCE_2]);

/** Filler that reads like prose and carries no banned phrase. */
function paragraph(n: number): string {
  const sentences = [
    "The change applies to pages that are already being fetched and parsed without difficulty.",
    "Site owners should confirm the behaviour on their own domain before drawing a conclusion.",
    "Measurement is the part teams skip, and it is the part that decides whether anything moved.",
    "A frozen prompt set makes the comparison readable from one week to the next.",
    "Nothing here depends on knowing how any particular system weighs a source internally.",
  ];
  return Array.from({ length: n }, (_, i) => sentences[i % sentences.length]).join(" ");
}

interface Overrides {
  frontmatter?: Record<string, string>;
  body?: string;
}

/** A draft that passes every rule. Mutations start from this. */
function validDraft(over: Overrides = {}): string {
  const fm: Record<string, string> = {
    slug: "a-brand-new-agent-drafted-article",
    title: "What the new crawler directive means for AI visibility",
    seoTitle: "What the New Crawler Directive Means",
    metaDescription:
      "A named publication reported a change to how crawlers are directed. Here is what it changes for AI visibility, and what remains unverified for now.",
    excerpt:
      "A change was reported this week that affects how AI crawlers are directed. What it means in practice, and what is still a hypothesis.",
    category: "Best Practices",
    tags: "[GEO, AI crawlers, robots.txt]",
    searchIntent: "informational",
    primaryKeyword: "crawler directive",
    secondaryKeywords: "[AI crawlers, robots.txt]",
    publishedAt: "2026-08-21",
    relatedTool: "free-audit",
    relatedSlugs: `[${SLUG_A}, ${SLUG_B}]`,
    status: "draft",
    featured: "false",
    ...over.frontmatter,
  };

  const tldr = [
    "  - A named publication reported the change this week.",
    "  - What it means for retrieval is a recommendation, not a rule.",
    "  - What it means for ranking remains unverified.",
  ].join("\n");

  const body =
    over.body ??
    [
      `The short answer: the directive changes which crawlers you can address by name, and nothing else. [Search Engine Land](${SOURCE_1}) reported it, and [Google's own post](${SOURCE_2}) confirms the scope. ${paragraph(6)}`,
      "",
      "## What actually changed",
      "",
      paragraph(14),
      "",
      "## What it means for AI visibility",
      "",
      `Our recommendation is to read your robots.txt end to end before changing anything. ${paragraph(14)}`,
      "",
      "## What is still unverified",
      "",
      `Stated as a hypothesis, because we cannot yet verify it: ${paragraph(14)}`,
      "",
      "## A checklist",
      "",
      "- Read robots.txt end to end and list every rule naming an AI agent.",
      "- Identify which rules were deliberate; document or delete the rest.",
      "- Re-check after any CDN or bot-protection change.",
      "- Confirm your headings are present in the raw HTML.",
      "",
      "## Where to start",
      "",
      `Run a [free GEO audit](/free-audit) to see what is actually fetched. ${paragraph(10)} See also [our measurement guide](/blog/${SLUG_A}) and [the citation gap](/blog/${SLUG_B}).`,
    ].join("\n");

  const frontmatter = [
    "---",
    ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`),
    "tldr:",
    tldr,
    "---",
    "",
  ].join("\n");

  return frontmatter + body + "\n";
}

const gate = (raw: string) =>
  runGate({ raw, existingSlugs: SLUGS, researchUrls: RESEARCH_URLS });

describe("fixture sanity", () => {
  it("the unmutated draft passes every rule", () => {
    // If this fails, every mutation test below is asserting nothing.
    const result = gate(validDraft());
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("sits inside the word band, computed rather than asserted by hand", () => {
    const words = bodyWordCount(validDraft().split("---")[2]);
    expect(words).toBeGreaterThanOrEqual(MIN_WORDS);
    expect(words).toBeLessThanOrEqual(MAX_WORDS);
  });

  it("injects the hero fields the model is told not to emit", () => {
    const result = gate(validDraft());
    expect(result.draft!.markdown).toContain(
      "featuredImage: /blog/a-brand-new-agent-drafted-article/hero.svg",
    );
    expect(result.draft!.markdown).toContain("featuredImageAlt:");
  });
});

describe("structure", () => {
  it("rejects output that is not frontmatter plus body", () => {
    const r = gate("Here is your article!\n\n## A heading\n\nSome prose.");
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/could not be parsed/i);
  });

  // The 05:00 run on 2026-08-27 produced zero drafts: every reply opened with a
  // conversational sentence, and the gate threw all of them away on "file does
  // not open with a --- frontmatter block". A preamble is not a quality problem.
  it("parses a draft the model introduced with a sentence", () => {
    const r = gate(`Here's the article you asked for:\n\n${validDraft()}`);
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
    // The frontmatter and the body are the ones from the draft, not a
    // best-effort salvage: the same slug, title and category the clean fixture
    // yields, and a body the word counter agrees is the article.
    const clean = gate(validDraft());
    expect(r.draft!.slug).toBe(clean.draft!.slug);
    expect(r.draft!.title).toBe(clean.draft!.title);
    expect(r.draft!.category).toBe(clean.draft!.category);
    expect(r.draft!.wordCount).toBe(clean.draft!.wordCount);
    expect(r.draft!.markdown).toBe(clean.draft!.markdown);
  });

  it("drops the preamble from the file it writes", () => {
    // Not merely tolerated — removed. A sentence above the frontmatter would be
    // committed into content/blog/ and rendered.
    const r = gate(`Here's the article you asked for:\n\n${validDraft()}`);
    expect(r.draft!.markdown.startsWith("---\n")).toBe(true);
    expect(r.draft!.markdown).not.toMatch(/Here's the article/);
  });

  it("scans the article, not the preamble, for banned copy", () => {
    // The preamble is discarded before the copy rules run, so a banned phrase in
    // a sentence that never reaches the file is not a reason to burn the retry.
    const r = gate(`Let's dive in — here is the draft:\n\n${validDraft()}`);
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("still rejects a reply with no frontmatter block at all", () => {
    // The bar moved for junk ABOVE the frontmatter, not for a missing one.
    const r = gate("Here is your article!\n\ntitle: Something\n\n## A heading\n\nProse.");
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/could not be parsed/i);
  });

  it("finds the frontmatter after a padded delimiter line", () => {
    expect(stripPreamble("preamble\n  ---  \ntitle: x")).toBe("---\ntitle: x");
    expect(stripPreamble("no delimiter here")).toBeNull();
  });

  it("rejects markdown the blog cannot render", () => {
    // #### has no LearnBlock, so it would fail `next build` — an outage, not a
    // bad article. Caught here instead.
    const r = gate(validDraft({ body: `${paragraph(200)}\n\n#### Too deep\n\n${paragraph(60)}` }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/cannot render/i);
  });

  it("rejects a body below the word floor", () => {
    const r = gate(validDraft({ body: `Short. [a](${SOURCE_1}) [b](${SOURCE_2})` }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/the minimum is 900/);
  });

  it("rejects a body above the ceiling", () => {
    const r = gate(validDraft({ body: paragraph(2000) }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/the maximum is 1600/);
  });

  it("requires a checklist of at least three bullets", () => {
    const withoutList = validDraft().replace(
      /- Read robots\.txt[\s\S]*?- Confirm your headings are present in the raw HTML\./,
      paragraph(4),
    );
    const r = gate(withoutList);
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/no checklist/i);
  });
});

describe("links", () => {
  it("rejects an invented internal slug", () => {
    // The failure mode this exists for: a model asked to link its own articles
    // produces a plausible slug, and a plausible slug is a 404 that reads fine.
    const r = gate(validDraft().replace(`/blog/${SLUG_A}`, "/blog/a-slug-that-never-existed"));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/do not exist/);
  });

  it("requires at least two working internal links", () => {
    const r = gate(
      validDraft().replace(`[the citation gap](/blog/${SLUG_B})`, "the citation gap"),
    );
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/at least 2 are required/);
  });

  it("requires a tool link from the allowlist", () => {
    const r = gate(validDraft().replace("[free GEO audit](/free-audit)", "free GEO audit"));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/no link to an Echorank tool/);
  });

  it("accepts every member of the tool allowlist", () => {
    for (const tool of TOOL_LINK_ALLOWLIST) {
      const r = gate(validDraft().replace("(/free-audit)", `(${tool})`));
      expect(r.failures.join(" "), tool).not.toMatch(/Echorank tool/);
    }
  });

  it("rejects an external link that was not one of the source pages", () => {
    // Fabricated attribution is the worst thing this pipeline could publish:
    // a real-looking citation to a page nobody read.
    const r = gate(validDraft().replace(SOURCE_1, "https://example.com/invented-source"));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/were not among your source pages/);
  });

  it("requires at least two of the source pages to be cited", () => {
    const r = gate(validDraft().replace(`[Google's own post](${SOURCE_2})`, "Google's own post"));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/at least 2 must be linked/);
  });
});

describe("the citation bar adapts to what research found", () => {
  it("requires two when two sources exist", () => {
    const r = gate(validDraft().replace(`[Google's own post](${SOURCE_2})`, "Google's own post"));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/at least 2 must be linked/);
  });

  it("requires only one on a single-source story", () => {
    // Measured 2026-08-21: the day's top story was covered by exactly one
    // outlet in the entire source set. A hard bar of two would mean the agent
    // silently drafts nothing on most days.
    const oneSource = new Set([SOURCE_1]);
    const draft = validDraft().replace(`[Google's own post](${SOURCE_2})`, "Google's own post");
    const r = runGate({ raw: draft, existingSlugs: SLUGS, researchUrls: oneSource });
    expect(r.failures.join(" ")).not.toMatch(/must be linked/);
    expect(r.ok).toBe(true);
  });

  it("still refuses an invented citation even with one source", () => {
    // The adaptive bar relaxes CORROBORATION. It must never relax the rule that
    // every external link is a page research actually read — that is the one
    // stopping fabricated attribution.
    const oneSource = new Set([SOURCE_1]);
    const draft = validDraft().replace(SOURCE_2, "https://example.com/never-read-this");
    const r = runGate({ raw: draft, existingSlugs: SLUGS, researchUrls: oneSource });
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/were not among your source pages/);
  });
});

describe("copy rules", () => {
  it("rejects every banned phrase", () => {
    for (const phrase of BANNED_PHRASES) {
      const r = gate(validDraft().replace("The short answer:", `${phrase}, the short answer:`));
      expect(r.ok, phrase).toBe(false);
      expect(r.failures.join(" "), phrase).toMatch(/banned phrases/);
    }
  });

  it("catches banned phrases whatever the casing", () => {
    const r = gate(validDraft().replace("The short answer:", "In Today's Digital Landscape,"));
    expect(r.ok).toBe(false);
  });

  it("rejects camel-case brand spellings anywhere in the draft", () => {
    for (const bad of ["EchoRank", "echoRank", "Echo Rank", "Echo-Rank"]) {
      const r = gate(validDraft().replace("free GEO audit", `${bad} audit`));
      expect(r.ok, bad).toBe(false);
      expect(r.failures.join(" "), bad).toMatch(/The brand is written/);
    }
  });

  it("allows the three legal renderings", () => {
    expect(brandOffenders("Echorank ECHORANK echorank")).toEqual([]);
  });
});

describe("frontmatter", () => {
  it("refuses to let the agent publish directly", () => {
    // The gate is the last thing between the model and content/blog/, so the
    // status rule lives here rather than only in the prompt.
    const r = gate(validDraft({ frontmatter: { status: "published" } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/status must be "draft"/);
  });

  it("rejects a slug that already exists", () => {
    // A slug that exists but is NOT in this draft's relatedSlugs — otherwise
    // the schema's "cannot be related to itself" refinement fires first and
    // this test passes without ever reaching the uniqueness check.
    const r = gate(validDraft({ frontmatter: { slug: SLUG_C } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/already exists/);
  });

  it("rejects a reserved slug", () => {
    const r = gate(validDraft({ frontmatter: { slug: "category" } }));
    expect(r.ok).toBe(false);
  });

  it("rejects a category outside the union", () => {
    const r = gate(validDraft({ frontmatter: { category: "Thought Leadership" } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/category/i);
  });

  it("rejects relatedSlugs that do not exist", () => {
    const r = gate(validDraft({ frontmatter: { relatedSlugs: "[not-a-real-article]" } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/relatedSlugs contains slugs that do not exist/);
  });

  it("rejects featured: true", () => {
    const r = gate(validDraft({ frontmatter: { featured: "true" } }));
    expect(r.ok).toBe(false);
    expect(r.failures.join(" ")).toMatch(/featured must be false/);
  });

  it("collects every failure at once rather than stopping at the first", () => {
    // The retry gets ONE shot. Reporting one problem per attempt would need as
    // many retries as there are problems, and there is budget for one.
    const broken = validDraft({ frontmatter: { status: "published", featured: "true" } })
      .replace("[free GEO audit](/free-audit)", "free GEO audit");
    const r = gate(broken);
    expect(r.failures.length).toBeGreaterThanOrEqual(3);
  });
});

describe("helpers", () => {
  it("counts words without markdown syntax", () => {
    // "bold and code and a link" — the syntax is stripped, the link LABEL is
    // kept because a reader reads it.
    expect(bodyWordCount("**bold** and `code` and [a link](/x)")).toBe(6);
  });

  it("extracts every link href", () => {
    expect(bodyLinks("see [a](/one) and [b](https://two.example)")).toEqual([
      "/one",
      "https://two.example",
    ]);
  });
});

// The two lines between the API response and runGate(). They are tested here
// rather than beside the transport because what they have to produce is defined
// by the gate: a whole document, starting at the frontmatter delimiter.
describe("assembling the reply the gate is handed", () => {
  const reply = (draft: string) => extractFenced(withPrefill(draft.replace(/^---\n/, "\n")));

  it("puts the prefill back, since the API does not echo it", () => {
    // The model is handed "---" and continues; on its own the continuation is
    // not a parseable document.
    expect(withPrefill("\ntitle: x\n---\nbody")).toBe("---\ntitle: x\n---\nbody");
  });

  it("does not double the delimiter when the model repeats it", () => {
    expect(withPrefill("---\ntitle: x")).toBe("---\ntitle: x");
  });

  it("hands the gate a draft that passes, end to end", () => {
    const r = gate(reply(validDraft()));
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("has no trailing whitespace — the API rejects a prefill that does", () => {
    expect(DRAFT_PREFILL).toBe(DRAFT_PREFILL.trimEnd());
  });

  it("unwraps a fence only when the fence opens the reply", () => {
    expect(extractFenced("```markdown\n---\ntitle: x\n---\n```")).toBe("---\ntitle: x\n---");
  });

  it("leaves a fenced code block inside the body alone", () => {
    // The unanchored regex matched the FIRST ``` anywhere and returned the code
    // sample as if it were the whole article.
    const doc = "---\ntitle: x\n---\n\nProse.\n\n```\nrobots.txt\n```\n\nMore prose.";
    expect(extractFenced(doc)).toBe(doc);
  });
});

describe("a reply the prefill did not reach", () => {
  it("leaves a fence-wrapped reply for extractFenced to unwrap", () => {
    // Prepending the delimiter would push it OUTSIDE the fence and turn a
    // readable reply into an unparseable one.
    const wrapped = "```markdown\n---\ntitle: x\n---\nbody\n```";
    expect(withPrefill(wrapped)).toBe(wrapped);
    expect(extractFenced(withPrefill(wrapped))).toBe("---\ntitle: x\n---\nbody");
  });
});

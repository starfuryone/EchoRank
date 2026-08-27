// src/lib/blog-agent/gate.ts
//
// The deterministic quality gate. Nothing reaches content/blog/ without passing.
//
// HEURISTICS ONLY, NO LLM JUDGE. A judge would be a second model call grading
// the first, at roughly the same cost, with no way to prove what it checked.
// Every rule below is a boolean a human can re-derive from the draft, and the
// failure message names the rule — which matters twice over, because those
// messages are what the retry prompt receives.
//
// THE GATE IS THE PROMPT'S ENFORCEMENT ARM. Read it beside prompt.ts: each
// hard rule there has a check here, and a rule that cannot be checked here is
// a rule the model may quietly ignore.

import { blogFrontmatterSchema } from "@/lib/blog/schema";
import { parseFrontmatter, parseMarkdown, MarkdownError } from "@/lib/blog/markdown";
import { readingTime, RESERVED_BLOG_SLUGS } from "@/lib/blog/constants";
import { BANNED_PHRASES, TOOL_LINK_ALLOWLIST } from "./prompt";

/** Body word count bounds, from the blog's own quality rules. */
export const MIN_WORDS = 900;
export const MAX_WORDS = 1_600;

export interface GateInput {
  /** The model's reply, already unfenced. */
  raw: string;
  /** Slugs of published articles — the internal links must resolve to these. */
  existingSlugs: ReadonlySet<string>;
  /** URLs the research actually fetched. External links must be among them. */
  researchUrls: ReadonlySet<string>;
}

export interface GateResult {
  ok: boolean;
  /** Human-readable, and fed verbatim into the retry prompt. */
  failures: string[];
  /** Present only when ok. */
  draft?: {
    slug: string;
    title: string;
    category: string;
    /** The full file contents, frontmatter included, ready to write. */
    markdown: string;
    wordCount: number;
    readingTime: number;
  };
}

/**
 * Alt text for the generated hero.
 *
 * The heroes are abstract token-coloured shapes, not depictions — so the alt
 * says what the reader is looking at and names the article, rather than
 * inventing a description of imagery that carries no information.
 */
export function heroAlt(title: string): string {
  return `Abstract Echorank cover graphic for the article "${title.replace(/"/g, "'")}"`;
}

/**
 * Find the frontmatter and throw away whatever the model wrote before it.
 *
 * WHY THE GATE TOLERATES A PREAMBLE. parseFrontmatter() requires the file to
 * open with `---`, which is right for a file on disk — a committed article with
 * a stray line above its frontmatter is a bug. A model reply is not a file. On
 * 2026-08-27 the 05:00 run drafted three articles and rejected all three on
 * "file does not open with a --- frontmatter block": one conversational sentence
 * before the delimiter, and $0.075 of drafting thrown away over a line nobody
 * wanted anyway. The prefill in client.ts stops it happening; this stops it
 * mattering.
 *
 * The bar is unchanged: reject only when there is NO frontmatter block at all.
 * A line of exactly `---` (trailing spaces ignored) opens one — everything above
 * it is dropped, including from the banned-phrase and brand checks, which is
 * correct: a preamble is not part of the article.
 *
 * Returns null when no such line exists, and the caller reports the parse
 * failure it always did.
 */
export function stripPreamble(raw: string): string | null {
  const lines = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => l.trim() === "---");
  if (start === -1) return null;
  // Re-emit the delimiter rather than slicing it: an indented or space-padded
  // `---` is a frontmatter opener the parser would otherwise refuse.
  return ["---", ...lines.slice(start + 1)].join("\n");
}

/** Body word count, ignoring markdown syntax so `**bold**` is one word. */
export function bodyWordCount(body: string): number {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*`>_|-]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Every [label](href) in the body. */
export function bodyLinks(body: string): string[] {
  return [...body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1].trim());
}

/**
 * Every spelling of the brand that is not one of the three legal renderings.
 *
 * Mirrors tests/brand-casing.test.ts deliberately: the same regex and the same
 * allow-list, so a draft cannot pass this gate and then fail the suite.
 */
export function brandOffenders(text: string): string[] {
  const allowed = new Set(["Echorank", "ECHORANK", "echorank"]);
  return [...new Set((text.match(/echo[\s-]*rank/gi) ?? []).filter((m) => !allowed.has(m)))];
}

/**
 * Run every check. Collects ALL failures rather than returning the first —
 * the retry gets one shot, and telling the model about one problem at a time
 * wastes it.
 */
export function runGate(input: GateInput): GateResult {
  const failures: string[] = [];
  // Everything downstream — the banned-phrase scan, the brand scan and the file
  // text itself — reads this, so the preamble is dropped once, here.
  const raw = stripPreamble(input.raw) ?? input.raw.trim();

  // ── Parse ────────────────────────────────────────────────────────────────
  let parsed: { frontmatter: Record<string, unknown>; body: string };
  try {
    parsed = parseFrontmatter(raw) as { frontmatter: Record<string, unknown>; body: string };
  } catch (err) {
    return {
      ok: false,
      failures: [
        `The output could not be parsed as frontmatter plus body: ${(err as Error).message}. It must open with --- on the very first line.`,
      ],
    };
  }

  // INJECT THE HERO FIELDS BEFORE VALIDATING, not after.
  //
  // The schema requires featuredImage and featuredImageAlt, and the prompt
  // tells the model NOT to emit them — the path is derived from the slug and
  // the file is written by the lander, so a model-chosen path would point at an
  // image nobody generated. Injecting after validation would mean every draft
  // failed the schema on two fields the model was told to omit.
  const slug = typeof parsed.frontmatter.slug === "string" ? parsed.frontmatter.slug : "";
  const title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : "";
  const heroFields = slug
    ? {
        featuredImage: `/blog/${slug}/hero.svg`,
        featuredImageAlt: heroAlt(title || slug),
      }
    : {};
  const fm = blogFrontmatterSchema.safeParse({ ...parsed.frontmatter, ...heroFields });
  if (!fm.success) {
    for (const issue of fm.error.issues) {
      failures.push(`Frontmatter field "${issue.path.join(".") || "(root)"}": ${issue.message}`);
    }
  }

  // The body must compile to the block vocabulary the blog renders. A draft
  // using #### or an inline image would fail the BUILD, which is an outage
  // rather than a bad article — so it is caught here instead.
  try {
    parseMarkdown(parsed.body);
  } catch (err) {
    const detail = err instanceof MarkdownError ? err.message : String(err);
    failures.push(
      `The body uses markdown the blog cannot render: ${detail}. Use only ##, ###, paragraphs, - bullets, 1. lists, > quotes, fenced code and pipe tables.`,
    );
  }

  // ── Length ───────────────────────────────────────────────────────────────
  const words = bodyWordCount(parsed.body);
  if (words < MIN_WORDS) failures.push(`The body is ${words} words; the minimum is ${MIN_WORDS}.`);
  if (words > MAX_WORDS) failures.push(`The body is ${words} words; the maximum is ${MAX_WORDS}.`);

  // ── Links ────────────────────────────────────────────────────────────────
  const links = bodyLinks(parsed.body);
  const internal = [...new Set(links.filter((h) => h.startsWith("/blog/")))];
  const unknown = internal.filter((h) => !input.existingSlugs.has(h.replace("/blog/", "").split("#")[0]));
  if (unknown.length) {
    failures.push(
      `These internal links point at articles that do not exist: ${unknown.join(", ")}. Use only slugs from the list you were given.`,
    );
  }
  const resolvable = internal.length - unknown.length;
  if (resolvable < 2) {
    failures.push(
      `The body has ${resolvable} working links to other Echorank articles; at least 2 are required.`,
    );
  }

  const toolLinks = links.filter((h) => TOOL_LINK_ALLOWLIST.includes(h.split("#")[0]));
  if (toolLinks.length < 1) {
    failures.push(
      `The body has no link to an Echorank tool. Include exactly one, chosen verbatim from: ${TOOL_LINK_ALLOWLIST.join(", ")}.`,
    );
  }

  // External links must be pages the research actually read. This is what
  // stops the model citing a plausible URL it never saw — the failure mode
  // that turns "attributed to named sources" into fabricated attribution.
  const external = links.filter((h) => h.startsWith("http"));
  //
  // The requirement ADAPTS to what research actually found. Two sources is the
  // bar when two exist; on a single-source story it would be a bar nothing can
  // clear, and the agent would silently draft nothing on most days. Measured on
  // 2026-08-21: the day's top story was covered by one outlet in the whole
  // source set.
  //
  // The rule that does the real work is the one below — every external link
  // must be a page research actually read. That is what stops fabricated
  // attribution, and it is absolute regardless of how many sources there were.
  const cited = external.filter((h) => input.researchUrls.has(h.split("#")[0]));
  const required = Math.min(2, input.researchUrls.size);
  if (cited.length < required) {
    failures.push(
      `The body cites ${cited.length} of the ${input.researchUrls.size} source URLs you were given; at least ${required} must be linked inline. Link them exactly as provided: ${[...input.researchUrls].join(", ")}.`,
    );
  }
  const invented = external.filter((h) => !input.researchUrls.has(h.split("#")[0]));
  if (invented.length) {
    failures.push(
      `These external links were not among your source pages and must be removed: ${invented.join(", ")}.`,
    );
  }

  // ── Copy rules ───────────────────────────────────────────────────────────
  const lower = raw.toLowerCase();
  const banned = BANNED_PHRASES.filter((p) => lower.includes(p));
  if (banned.length) {
    failures.push(`Remove these banned phrases: ${banned.map((b) => `"${b}"`).join(", ")}.`);
  }

  const brand = brandOffenders(raw);
  if (brand.length) {
    failures.push(
      `The brand is written "Echorank". These spellings are wrong: ${brand.join(", ")}.`,
    );
  }

  // A checklist is required, and one bullet is not a checklist.
  const bulletRuns = parsed.body.split(/\n\s*\n/).filter((block) => {
    const lines = block.split("\n").filter((l) => /^\s*-\s+\S/.test(l));
    return lines.length >= 3;
  });
  if (!bulletRuns.length) {
    failures.push("The body has no checklist. Include at least one list of 3 or more `- ` bullets.");
  }

  // ── Frontmatter-dependent checks ─────────────────────────────────────────
  if (fm.success) {
    const data = fm.data;
    if (data.status !== "draft") {
      failures.push(`status must be "draft"; the agent never publishes directly.`);
    }
    if (data.featured) failures.push("featured must be false.");
    if (RESERVED_BLOG_SLUGS.includes(data.slug)) {
      failures.push(`"${data.slug}" is a reserved route segment and cannot be a slug.`);
    }
    if (input.existingSlugs.has(data.slug)) {
      failures.push(`The slug "${data.slug}" already exists. Choose a different one.`);
    }
    // relatedSlugs must be real too — it drives the Related strip, which is
    // rendered, not just metadata.
    const badRelated = data.relatedSlugs.filter((s) => !input.existingSlugs.has(s));
    if (badRelated.length) {
      failures.push(`relatedSlugs contains slugs that do not exist: ${badRelated.join(", ")}.`);
    }
  }

  if (failures.length) return { ok: false, failures };

  const data = fm.success ? fm.data : null;
  if (!data) return { ok: false, failures: ["Frontmatter did not validate."] };

  // The same two lines that were validated above, written into the file text.
  // Derived from `data`, so the file and the validated object cannot disagree.
  const withImage = raw.replace(
    /^---\n/,
    `---\nfeaturedImage: ${data.featuredImage}\nfeaturedImageAlt: "${data.featuredImageAlt.replace(/"/g, "'")}"\n`,
  );

  return {
    ok: true,
    failures: [],
    draft: {
      slug: data.slug,
      title: data.title,
      category: data.category,
      markdown: withImage.endsWith("\n") ? withImage : `${withImage}\n`,
      wordCount: words,
      readingTime: readingTime(parsed.body),
    },
  };
}

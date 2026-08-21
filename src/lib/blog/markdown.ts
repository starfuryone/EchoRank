// src/lib/blog/markdown.ts
//
// Frontmatter + a MARKDOWN SUBSET, compiled to the repo's existing LearnBlock
// vocabulary. Pure functions over strings: no filesystem, no dependencies, no
// React — which is what makes the whole thing testable in one suite.
//
// WHY NOT remark/rehype. src/lib/learn-content.ts and src/lib/help-articles.ts
// both say in as many words that this repo has no markdown loader and no MDX
// pipeline and that neither is being added. The brief for this feature agreed
// with the constraint ("prefer zero new heavy deps, Turbopack-safe") even while
// naming remark as an option. remark + rehype + gray-matter is roughly a dozen
// transitive packages on a box that serves production from its working tree,
// for a job whose input we write ourselves.
//
// So the pipeline goes markdown -> LearnBlock[], and the BLOCKS are rendered by
// src/app/[locale]/learn/_shared/Blocks.tsx — the same component the Knowledge
// Hub and the help articles use. Two things follow, both deliberate:
//
//   1. Blog prose cannot drift into a second article design. It renders through
//      the same vocabulary, with the same inline() handling **bold**, `code`
//      and [links](/paths), and the same "no dangerouslySetInnerHTML anywhere"
//      posture — a stray "<" in an article is text, never markup.
//   2. The supported syntax is exactly what LearnBlock can express. That is a
//      SUBSET and is meant to be: #### headings, images, nested lists, inline
//      HTML and reference links are not supported, and unsupported syntax is
//      not silently dropped — parseMarkdown throws, so the build fails rather
//      than publishing an article with a paragraph missing.
//
// Supported: ## / ###, paragraphs, - and * bullets, 1. ordered lists,
// > blockquotes, ``` fenced code, | pipe | tables |, --- ignored as a rule.

import type { LearnBlock } from "@/lib/learn-content";
import { headingId } from "@/lib/learn-content";

/** Raised on any input the subset cannot represent. Always a build failure. */
export class MarkdownError extends Error {
  constructor(message: string, public readonly line?: number) {
    super(line === undefined ? message : `line ${line}: ${message}`);
    this.name = "MarkdownError";
  }
}

// ── Frontmatter ────────────────────────────────────────────────────────────

/**
 * The YAML SUBSET the frontmatter block is allowed to use.
 *
 * `key: scalar`, `key: [a, b]`, and block sequences whose items are either
 * scalars or one level of `key: value` pairs. Nothing else — no anchors, no
 * multi-line scalars, no maps inside maps. A real YAML parser would accept far
 * more than the schema next door can validate, and every extra shape it accepts
 * is a shape someone eventually writes.
 */
export type FrontmatterValue = string | boolean | string[] | Record<string, string>[];

/** Strip one layer of matching quotes; leave an unquoted scalar alone. */
function unquote(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s.slice(1, -1).replace(/\\"/g, '"');
  }
  return s;
}

/** Scalars are strings, except the two booleans the schema actually uses. */
function scalar(raw: string): string | boolean {
  const s = unquote(raw);
  if (s === "true") return true;
  if (s === "false") return false;
  return s;
}

/**
 * Split "[a, b, c]" respecting quoted commas.
 *
 * A naive split(",") breaks `secondaryKeywords: ["ai citations, tracked"]`,
 * and a keyword phrase containing a comma is exactly the sort of thing an
 * editor writes without thinking about the parser.
 */
function splitInline(body: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ",") { out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

export interface ParsedFile {
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
}

/**
 * Split a .md file into its frontmatter map and its markdown body.
 *
 * The delimiter must be the very first line: a file whose "---" sits after a
 * blank line has no frontmatter at all, and treating the first "---" anywhere
 * as an opener would swallow a horizontal rule and everything above it.
 */
export function parseFrontmatter(source: string): ParsedFile {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    throw new MarkdownError("file does not open with a --- frontmatter block");
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) throw new MarkdownError("frontmatter block is never closed");

  const head = text.slice(4, end).split("\n");
  const body = text.slice(end + 4).replace(/^\n+/, "");

  const frontmatter: Record<string, FrontmatterValue> = {};
  let listKey: string | null = null;
  let list: string[] = [];
  let maps: Record<string, string>[] = [];

  const flush = () => {
    if (!listKey) return;
    // A key opened as a block sequence collects into whichever accumulator its
    // first item chose. Both shapes are emitted as-is; the schema decides which
    // is legal for that key, so a `tags:` written as maps fails validation with
    // a useful message instead of arriving here as a silent empty array.
    frontmatter[listKey] = (maps.length ? maps : list) as FrontmatterValue;
    listKey = null;
    list = [];
    maps = [];
  };

  head.forEach((raw, i) => {
    const line = raw.trimEnd();
    const lineNo = i + 2; // +1 for 1-based, +1 for the opening "---"
    if (!line.trim() || line.trim().startsWith("#")) return;

    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (!listKey) throw new MarkdownError("list item with no key above it", lineNo);
      const inner = item[1].trim();
      // "- key: value" opens a map item; a later indented "key: value" line
      // adds to the SAME item. That two-line form is the only reason this
      // parser knows about maps at all: an FAQ answer is a sentence, and
      // folding it onto the "- q:" line makes the file unreadable.
      const kv = /^([A-Za-z][A-Za-z0-9_]*):\s*(.+)$/.exec(inner);
      if (kv) {
        maps.push({ [kv[1]]: unquote(kv[2]) });
        return;
      }
      list.push(unquote(inner));
      return;
    }

    // Indented continuation of the map item opened by the last "- key: value".
    const cont = /^\s+([A-Za-z][A-Za-z0-9_]*):\s*(.+)$/.exec(line);
    if (cont) {
      const current = maps[maps.length - 1];
      if (!current) throw new MarkdownError(`indented "${cont[1]}" with no list item above it`, lineNo);
      current[cont[1]] = unquote(cont[2]);
      return;
    }

    const kv = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!kv) throw new MarkdownError(`unparseable frontmatter line: ${line.trim()}`, lineNo);
    flush();
    const [, key, rest] = kv;
    if (rest.trim() === "") { listKey = key; return; }
    const arr = /^\[(.*)\]$/.exec(rest.trim());
    frontmatter[key] = arr ? splitInline(arr[1]) : scalar(rest);
  });
  flush();

  return { frontmatter, body };
}

// ── Body ───────────────────────────────────────────────────────────────────

/** A table row: "| a | b |" → ["a", "b"]. Leading/trailing pipes optional. */
function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const IS_DIVIDER = (line: string) => /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(line);

/**
 * Compile a markdown body into LearnBlock[].
 *
 * Deliberately line-based rather than a recursive parser: the subset has no
 * nesting, so a state machine over lines is the whole job, and it can point at
 * the offending line number when it refuses.
 */
export function parseMarkdown(body: string): LearnBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: LearnBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ k: "p", t: para.join(" ").trim() });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flushPara(); continue; }

    // A horizontal rule is a typographic separator with no LearnBlock. It is
    // dropped rather than refused: authors use it, and rendering nothing is
    // the honest translation.
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) { flushPara(); continue; }

    if (trimmed.startsWith("#")) {
      flushPara();
      const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (!h) throw new MarkdownError(`malformed heading: ${trimmed}`, i + 1);
      const level = h[1].length;
      // H1 is the page's <h1>, rendered from `title`. A second one in the body
      // would give the article two top-level headings; #### and deeper have no
      // block and no TOC level, so both are refused rather than downgraded.
      if (level === 1) throw new MarkdownError("h1 in body — the title is the h1", i + 1);
      if (level > 3) throw new MarkdownError(`h${level} is not supported; use ## or ###`, i + 1);
      blocks.push({ k: level === 2 ? "h2" : "h3", t: h[2].trim() });
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushPara();
      const code: string[] = [];
      let closed = false;
      for (i++; i < lines.length; i++) {
        if (lines[i].trim().startsWith("```")) { closed = true; break; }
        code.push(lines[i]);
      }
      if (!closed) throw new MarkdownError("unterminated code fence", i + 1);
      blocks.push({ k: "code", t: code.join("\n") });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushPara();
      const paras: string[] = [];
      let cur: string[] = [];
      for (; i < lines.length && lines[i].trim().startsWith(">"); i++) {
        const t = lines[i].trim().replace(/^>\s?/, "");
        if (!t.trim()) { if (cur.length) { paras.push(cur.join(" ")); cur = []; } continue; }
        cur.push(t);
      }
      i--;
      if (cur.length) paras.push(cur.join(" "));
      blocks.push({ k: "quote", paras });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      flushPara();
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) break;
        // Indented continuations would be nested lists, which LearnBlock cannot
        // express. Refusing is the point — a silently flattened sub-list reads
        // as an editing mistake nobody made.
        if (/^\s{2,}[-*\d]/.test(lines[i])) {
          throw new MarkdownError("nested lists are not supported", i + 1);
        }
        const m = ordered ? /^\d+[.)]\s+(.*)$/.exec(t) : /^[-*]\s+(.*)$/.exec(t);
        if (!m) break;
        items.push(m[1].trim());
      }
      i--;
      blocks.push(ordered ? { k: "ol", items } : { k: "ul", items });
      continue;
    }

    if (trimmed.startsWith("|") && IS_DIVIDER(lines[i + 1] ?? "")) {
      flushPara();
      const head = tableCells(trimmed);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        const cells = tableCells(lines[i]);
        if (cells.length !== head.length) {
          throw new MarkdownError(
            `table row has ${cells.length} cells, header has ${head.length}`,
            i + 1,
          );
        }
        rows.push(cells);
      }
      i--;
      blocks.push({ k: "table", head, rows });
      continue;
    }

    // An image is a figure, and LearnBlock only carries one inside a {k:"steps"}
    // walkthrough. Blog articles get their single image from `featuredImage`,
    // so an inline one is a mistake worth naming.
    if (/^!\[/.test(trimmed)) {
      throw new MarkdownError("inline images are not supported; use featuredImage", i + 1);
    }

    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

/**
 * The h2s of a body, for the article's table of contents.
 *
 * h3s are deliberately excluded. The brief allowed either; at 900-1,600 words
 * an article has four to seven h2s, and folding the h3s in doubles the list
 * into something a reader scans past instead of using.
 */
export function tocOf(blocks: readonly LearnBlock[]): { id: string; text: string }[] {
  return blocks
    .filter((b): b is { k: "h2"; t: string } => b.k === "h2")
    .map((b) => ({ id: headingId(b.t), text: b.t }));
}

/**
 * Anchor id for a heading.
 *
 * Re-exported from learn-content rather than reimplemented: Blocks.tsx stamps
 * its h2 ids with headingId(), so a second copy of the same five-line transform
 * would be two functions that must agree forever, and the day they stop
 * agreeing every TOC link on the blog scrolls nowhere.
 */
export { headingId as headingSlug } from "@/lib/learn-content";

/** Index of the block after the Nth h2 — where the mid-article CTA lands. */
export function indexAfterHeading(blocks: readonly LearnBlock[], nth: number): number {
  let seen = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].k === "h2" && ++seen === nth) {
      // Land after the section's opening paragraph, not immediately under the
      // heading: a CTA wedged between an h2 and its first sentence reads as an
      // ad break in the middle of the answer.
      const next = blocks.findIndex((b, j) => j > i && b.k === "p");
      return next === -1 ? blocks.length : next + 1;
    }
  }
  return blocks.length;
}

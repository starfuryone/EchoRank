# Writing a blog article

One article is one markdown file: `content/blog/en/<slug>.md`. There is no CMS
and no database — the loader reads this directory at build time, validates every
file against `src/lib/blog/schema.ts`, and compiles the body into the block
vocabulary the site renders.

**Validation is at BUILD time, which means a malformed file is a red build, not
a broken page.** That is the trade this format makes: nothing renders
`undefined` into a meta description, and nothing ships a link to an article that
does not exist — but a typo'd enum stops the deploy. Everything below is a rule
the build enforces, written down so you meet it on the first attempt.

The blog agent (`src/lib/blog-agent/`) drafts into the same directory under the
same rules, and its quality gate is a superset of this file. If you are changing
a rule here, `src/lib/blog-agent/prompt.ts` and `gate.ts` change with it.

---

## Locales

`content/blog/en/` is the only directory that exists today. `content/blog/fr/`
is supported by the loader — `fr*` locales read it and fall back to the English
body when a file is absent — but nothing has been translated yet. Everything
else (`de-CH`, `en-CA`) resolves to `en` by design.

---

## Frontmatter

Every key below is required unless marked OPTIONAL, and **no other key is
allowed** — the schema is `.strict()`, so an unrecognised key is an error rather
than an extra. That specifically includes `readingTime` (computed from the body),
`author` (one constant, `BLOG_AUTHOR`) and any field you invent.

| Key | Accepts |
|---|---|
| `slug` | lowercase `a-z0-9` words joined by single hyphens. Must match the filename. Never `page`, `category`, `rss`, `rss.xml` — those are routes. |
| `title` | 10–120 characters. Rendered as the h1. |
| `seoTitle` | 10–75 characters. The `<title>`; `brandTitle()` appends the brand, so do not. |
| `metaDescription` | **70–165 characters.** Over 165 fails the build. Under 120 wastes the slot. |
| `excerpt` | 60–320 characters. Used as both the card blurb and the on-page lede. |
| `category` | exactly one of: `GEO Guides`, `Best Practices`, `Use Cases`, `AI Visibility`, `Research`, `Tools` |
| `tags` | 1–8 items, each 2+ characters. Inline array: `[GEO, robots.txt]` |
| `searchIntent` | exactly one of: `informational`, `commercial`, `transactional`, `navigational` |
| `primaryKeyword` | 3+ characters. |
| `secondaryKeywords` | up to 10 items, each 3+ characters. Inline array. |
| `publishedAt` | `YYYY-MM-DD`, and a real calendar date (`2026-02-31` is rejected). |
| `updatedAt` | OPTIONAL. Same format, and never earlier than `publishedAt`. |
| `featuredImage` | `/blog/<slug>/hero.svg` — see [Hero image](#hero-image). |
| `featuredImageAlt` | 10+ characters. Required, deliberately: a hero with no alt is the most common accessibility regression in a content system, and the only way to stop it is to make the file unparseable without one. |
| `tldr` | 3–5 bullets, each over 20 characters. Block sequence. Renders as the accent-bordered summary box. |
| `faq` | OPTIONAL. If present: 2+ items, `q` 10+ chars, `a` 30+ chars. Its presence is what emits the `FAQPage` JSON-LD, so an empty FAQ section and a missing node cannot come apart. |
| `relatedTool` | exactly one of: `free-audit`, `free-tools`, `pricing`, `ai-assistant` — see below. |
| `relatedSlugs` | up to 6 slugs of articles that **already exist** in this directory, lowercase and hyphenated. Never your own slug. Inline array. Drives the Related strip, so a wrong one is a rendered 404. |
| `status` | `draft` or `published`. A `draft` reaches no list, no sitemap and no feed. |
| `featured` | `true` or `false`. |

### `relatedTool` is a key, not a URL

This is the field that trips people and models alike, because two different
things in this repo are called "tool":

- **`relatedTool`** is the CTA key at the end of the article. It is one of the
  four words above, and `BLOG_TOOL_HREF` turns it into a path. Writing
  `/free-audit` here fails the build.
- **The tool link in the body** is a real path, written as a markdown link.

Every member of the `relatedTool` union is a route that exists. It is a closed
list on purpose: the brief this feature was built from named four tool pages
that were never real, and the union is what stops the next article inventing a
fifth.

### Example

```yaml
---
slug: ai-crawler-directives
title: "What the new crawler directive changes for AI visibility"
seoTitle: "The New Crawler Directive, Explained"
metaDescription: "A named publication reported a change to how AI crawlers are directed. What it changes in practice, and what is still unverified."
excerpt: "A change was reported this week that affects how AI crawlers are directed. What it means in practice, and what remains a hypothesis."
category: Best Practices
tags: [GEO, AI crawlers, robots.txt]
searchIntent: informational
primaryKeyword: crawler directive
secondaryKeywords: [AI crawlers, robots.txt]
publishedAt: 2026-08-27
featuredImage: /blog/ai-crawler-directives/hero.svg
featuredImageAlt: "Abstract Echorank cover graphic for the crawler directive article"
tldr:
  - A named publication reported the change this week.
  - What it means for retrieval is a recommendation, not a rule.
  - What it means for ranking remains unverified.
relatedTool: free-audit
relatedSlugs: [how-to-measure-ai-search-visibility, find-your-ai-citation-gap]
status: draft
featured: false
---
```

`faq`, when you include it, is a block sequence of two-line items:

```yaml
faq:
  - q: "A question?"
    a: "An answer of at least thirty characters."
```

---

## Body

The body compiles to a fixed block vocabulary (`src/lib/blog/markdown.ts`).
Anything outside it throws, with the line number:

- **Headings: `##` and `###` only.** `#` is rejected — the title is the h1 — and
  `####` has no block to compile to.
- **Paragraphs**, `- ` bullets, `1. ` numbered lists, `> ` quotes, fenced code
  blocks, and pipe tables whose rows all carry the header's cell count.
- **No inline images.** `![alt](path)` is rejected. An article's one image is
  the hero; a figure is only expressible inside a `{k:"steps"}` walkthrough,
  which the blog does not use.
- **No nested or indented lists.** One level. A silently flattened sub-list
  reads as an editing mistake nobody made, so it refuses instead.
- **Links** are `[label](path)`. Internal article links are `/blog/<slug>` and
  the slug must exist.

Length: **900–1,600 words**. That band is the agent's gate rather than the
schema, but it is the house standard for a hand-written article too.

---

## Hero image

`public/blog/<slug>/hero.svg`, referenced from frontmatter as
`/blog/<slug>/hero.svg`. The agent generates one with `renderHero()`; a
hand-written article needs the file put there before the build reads the
frontmatter that points at it.

---

## Publishing

Write with `status: draft`. Nothing with that status reaches a list page, the
sitemap or the RSS feed, so a draft can sit in the tree safely.

To publish, change one line — `status: draft` → `status: published` — and
rebuild. The build is what makes the article exist; see the deploy sequence in
`CLAUDE.md`, and remember Cloudflare → Purge Everything afterwards.

---

## Before you commit

```
npx tsc --noEmit && npx vitest run tests/blog-loader.test.ts
```

The loader test parses every file in this directory against the schema, so it
catches a bad enum or a missing key without a full `next build`. A full build is
still the real check, because it is the one that compiles the body.

Copy rules apply here as they do everywhere else in the repo: the brand is
**Echorank**, never `EchoRank`, `echoRank` or `Echo Rank`.
`tests/brand-casing.test.ts` scans `src/app/[locale]` and the illustrations, not
this directory — so in a hand-written article that rule is on you. The agent's
gate checks its own drafts (`brandOffenders()` in `src/lib/blog-agent/gate.ts`).

# Echorank — Nosy Bat™ Public Page (Phase 4f-lite)

Repo: /opt/echorank/app. Conventions in CLAUDE.md / AGENTS.md apply. Run as `deploy`. One session, one commit per numbered task. No deploy without being told.

Prerequisites: SITE-CRAWLER-BRANDING.md and SITE-CRAWLER-NAV.md committed (`CRAWLER_BRAND`, route `/crawler`). Phase 3a may be partial — this page gates on what exists. If `CRAWLER_BRAND` is missing, STOP and report.

This supersedes the "Phase 4f" section of SITE-CRAWLER-PHASE4.md: the page is built now, gated; Phase 4 sub-phases only flip flags and add rows. Update that spec's 4f section to say so and commit the edit with task 1.

## Phase 0 — investigate (no edits)

Locate: the route-handler landing pattern (`src/app/[locale]/technical-geo/{route.ts,landing-html.ts}`) and the page-component pattern (`src/app/[locale]/solutions/[category]/[slug]/page.tsx` with `home2` module + Binance tokens) — pick the **page-component** pattern (this page needs gating logic and shared components; a String.raw HTML payload cannot read flags); `PublicNav` (mega menu, Solutions › By goal and Resources › Learn columns, en/fr `NAV` record); `PublicFooter`; `LOCALIZED_ROUTES` in `src/lib/seo/registry.ts`; the mega-nav and sitemap tests; `PLAN_CONFIGS` + `PricingSection`; the `/learn` content config (`src/lib/learn-content.ts`, guides, Article JSON-LD); the help-hub `pageHelp` map; `packages/crawl-rules` (`RULES`, family ids) if present; `plan-config.ts` crawl caps; the feature-flag module (`src/lib/flags.ts`, created by the homepage task if it ran; else create it here). Print the file map.

## Single copy source

`src/lib/site-crawler/marketing-copy.ts` (typed, en + fr, de-CH folds to en):

```ts
export type CrawlCapability = {
  id: string;            // anchor + flag key, kebab: "response-codes"
  gate: { family?: string } | { flag?: string } | { always: true };
  title: { en: string; fr: string };
  body:  { en: string; fr: string };
};
export const CRAWL_CAPABILITIES: readonly CrawlCapability[]
export const CRAWL_FEATURE_ROWS: readonly { id; label: {en,fr}; gate; caps: Record<'STARTER'|'GROWTH'|'AGENCY', string | true> }[]
export const CRAWL_FAQ: readonly { q: {en,fr}; a: {en,fr} }[]
```

Gate semantics, evaluated server-side at render: `family` → that family id exists in `RULES` (registry import; if the package is absent, every family gate is false); `flag` → `flags['crawl.<name>']` is true in production; `always` → shown. A gated-off item renders nothing — no placeholder, no "coming soon".

Rule count: `RULE_COUNT` as defined in SITE-CRAWLER-HOMEPAGE.md (derived, rounded down, never typed); reuse that helper if it exists, else create `src/lib/site-crawler/rule-count.ts` and have the homepage task use it.

## Task 1 — `/[locale]/site-crawler`

Page component, `home2` module, Binance tokens, "Echorank" branding only, every CTA button → `/pricing` (signed-in users see "Open Nosy Bat" → `/crawler` instead; reuse the auth-aware CTA pattern from the top nav).

Sections, in order:

1. **Hero** — lockup `CRAWLER_BRAND.logoOnDark` (height 72), H1 "The site crawler that shows its evidence.", lead "Nosy Bat crawls every page of a site the way a search engine does, checks each one against `{RULE_COUNT}`+ rules, and puts the proof next to every finding. Hosted, scheduled, shared with your team — nothing to install.", CTA "See plans", secondary text link "How it compares to a desktop crawler" → `#hosted`.
2. **What Nosy Bat crawls and reports** (`#reports`) — intro paragraph, then `CRAWL_CAPABILITIES` in two columns, each item `<h3 id={id}>` + body, bold term then dash, exactly the copy below. Closer line under the list.
3. **Every feature, by plan** (`#features`) — `CRAWL_FEATURE_ROWS` as a four-column table: Feature · Starter · Growth · Agency; cells show ✓ or the cap string; gated rows hidden. Caps come from `plan-config.ts` (crawl URL cap, crawls/month, rendered pages, extractors, schedules, kept crawls) — read them, never type them.
4. **Hosted, not installed** (`#hosted`) — four short cards: *One plan, your whole team* (per-tenant seats vs per-user licences), *Runs on our servers* (no RAM limit on your laptop, 25,000 URLs per crawl on Agency), *On a schedule* (gated on `crawl.schedule`), *Everything exports* (CSV on every table; Sheets + PDF gated on `crawl.reports`).
5. **Pricing strip** — the three plan cards from `PricingSection` (reuse the component; no new pricing copy).
6. **FAQ** (`#faq`) — `CRAWL_FAQ`, FAQPage JSON-LD generated from the same array.

Metadata: title "Nosy Bat — site crawler by Echorank", description from the lead, canonical + hreflang via `buildMetadata`, OG image = `/nosy-bat/nosy-bat-mark-on-dark.svg` rasterised once to `public/nosy-bat/og.png` (1200×630, mark left, wordmark right, dark bg) at build time by a script in `scripts/`, committed. SoftwareApplication JSON-LD for the crawler with `isPartOf` → the Echorank application node, offers from `PLAN_CONFIGS`.

Registry: `LOCALIZED_ROUTES` add `/site-crawler` priority 0.7. Nav: Solutions › By goal gains "Crawl your site (Nosy Bat)" / "Explorer votre site (Nosy Bat)"; Resources › Learn gains the guide from task 2. Update the mega-nav and sitemap tests. Footer: add under Product.

Tests: page renders en + fr; with an empty registry stub only `always`/flag-true items render; with a stub registry containing `response_codes` only, that one capability renders; FAQ JSON-LD count equals rendered FAQ count; no literal digits for the rule count (same regex as the homepage test); every capability `id` is unique and used as an anchor.

Visual: build, throwaway port, Playwright screenshots `/en/site-crawler` and `/fr/site-crawler` at 390 and 1280 px; report paths. Two-column list must collapse to one at 390.

Commit: `public: /site-crawler page for Nosy Bat™ (gated capability list, feature table, FAQ)`.

## Task 2 — `/learn/guides/what-nosy-bat-checks`

Add a guide entry to `learn-content.ts` (en body first pass, fr title/description, same chrome as other guides): intro (two paragraphs on what a crawl collects and how evidence is shown), then the capability list rendered from `CRAWL_CAPABILITIES` with the same gates (the guide imports the array; no copy duplicated), then "How to read a finding" (issue / warning / opportunity, evidence, how-to-fix, not assessable), then a CTA block → `/site-crawler`. Article JSON-LD from the existing guide pattern. Resources › Learn nav entry "What Nosy Bat checks" / "Ce que Nosy Bat vérifie".

Commit: `learn: "What Nosy Bat checks" guide from the shared capability source`.

## Task 3 — in-app help slot

`pageHelp` map: `/crawler` → the task 2 guide slug, so the Help button on the crawler page opens it (in a new tab, as the help hub does for public `/learn` pages).

Commit: `help: crawler page Help opens the Nosy Bat guide`.

## Copy — `CRAWL_CAPABILITIES` (EN source of truth; FR must carry the same meaning, not a literal translation)

Intro (EN): "Nosy Bat is the site crawler inside Echorank. It fetches every page the way a search engine would, runs each one through the rule library, and keeps the evidence next to every finding. A crawl collects, among other things:"
Intro (FR): "Nosy Bat est le robot d'exploration intégré à Echorank. Il lit chaque page comme le ferait un moteur de recherche, la passe dans la bibliothèque de règles et garde la preuve à côté de chaque constat. Une exploration recueille, entre autres :"

| id | gate | EN title | EN body |
|---|---|---|---|
| response-codes | family response_codes | Response codes | Broken links and server errors: no response, timeouts, 4XX and 5XX, on internal and external URLs, each with the page it was found on. |
| redirects | family response_codes | Redirects | 301s, 302s, meta refresh and JavaScript redirects, every hop of a chain, and loops. |
| blocked-urls | family response_codes | Blocked URLs | Pages the live robots.txt keeps crawlers out of, and what a draft robots.txt would change, before you publish it. *(second clause gated on flag crawl.customRobots — render the first clause alone until then)* |
| external-links | flag crawl.links | External links | Every outbound link with its status code, anchor text and source page. |
| site-structure | flag crawl.links | Site structure | Indexability and crawl depth by directory, orphan pages, and the pages that carry the most internal links. |
| internal-linking | family links | Internal linking | Inlink and outlink counts per page, nofollow links, pages reachable from only one place, links to redirects, links with parameters. |
| anchor-text | family links | Anchor text | Every anchor, aggregated and per link, with the non-descriptive ones ("click here", "read more") flagged. |
| security | family security | Security | HTTP pages, mixed content, forms posting over HTTP, missing HSTS, CSP, X-Content-Type-Options, X-Frame-Options and Referrer-Policy headers, unsafe `target=_blank`. |
| url-issues | family url | URL issues | Non-ASCII characters, underscores, uppercase, parameters, over-long URLs, repeated path segments, multiple slashes, trailing-slash variants. |
| page-titles | family page_titles | Page titles | Missing, duplicate, long, short, multiple, same as the H1, measured in characters and pixels. |
| meta-descriptions | family meta_description | Meta descriptions | Missing, duplicate, long, short, multiple, measured in characters and pixels. |
| headings | family h1 | Headings | H1 and H2 missing, duplicate, long, empty, multiple, or out of sequence. |
| content | family content | Content | Word count, readability, thin pages, placeholder text, soft 404s, text-to-HTML ratio, missing language attribute. |
| directives | family directives | Directives | noindex, nofollow, none, noarchive, nosnippet and the rest, in meta robots or X-Robots-Tag, and the conflicts between them. |
| canonicals | family canonicals | Canonicals | Link elements and HTTP headers, canonicals that point at redirects, errors or noindexed pages, header-vs-HTML mismatches. |
| pagination | family pagination | Pagination | rel="next" and rel="prev" targets, sequence errors, paginated pages canonicalised to the first. |
| hreflang | family hreflang | hreflang | Missing return tags, missing self-reference and x-default, invalid language or region codes, hreflang to non-200 or noindexed pages. |
| duplicate-content | family content | Duplicate content | Exact duplicates by content hash, near-duplicates by similarity, and repeated titles, descriptions and headings across the site. |
| rendering | flag crawl.render | Rendering | JavaScript sites rendered in headless Chromium, so React, Vue and Angular pages are crawled as a search engine sees them. |
| javascript | family javascript | JavaScript dependence | Content, links, titles, descriptions, headings and canonicals that exist only after JavaScript runs, and noindex tags that JavaScript adds or removes. |
| images | family images | Images | Missing alt text, over-long alt text, alt equal to the filename, missing width and height, oversized files, broken images. |
| validation | family validation | Validation | Missing doctype, elements in the wrong place in `<head>`, duplicate `<html>` or `<body>`, missing viewport: the things that stop a bot parsing a page reliably. |
| user-agent | flag crawl.config | User agent | Crawl as Nosy Bat, as Googlebot smartphone or desktop, or as any custom string on a site you have verified. |
| custom-headers | flag crawl.config | Custom headers and cookies | Send any request header, a cookie string or HTTP basic auth with every fetch. |
| custom-search | flag crawl.extraction | Custom source search | Search every page's source for a string or a pattern: a tracking tag, a keyword, a snippet of code. |
| custom-extraction | flag crawl.extraction | Custom extraction | Pull any value from the HTML with CSS selectors, XPath or a regular expression: prices, SKUs, authors, dates, social tags. |
| custom-javascript | flag crawl.customJs | Custom JavaScript | Run your own snippet in the rendered page and keep what it returns: scroll, click "load more", read a data layer. |
| google-analytics | flag crawl.ga4 | Google Analytics | GA4 sessions, users, engagement and key events per landing page, on the same row as the crawl data. |
| search-console | flag crawl.gsc | Search Console | Clicks, impressions, CTR and position per page for the last 28 days, joined to every crawled URL. |
| pagespeed | flag crawl.psi | PageSpeed Insights | Lighthouse scores, Core Web Vitals field data and the top performance opportunities for the pages you choose. |
| mobile-usability | family mobile | Mobile usability | Viewport, font size, tap targets and content wider than the screen, from the rendered page and Lighthouse. |
| backlinks | flag crawl.backlinks | Backlink metrics | Referring domains and backlink counts per URL, so you know which broken or redirecting pages are costing you links. |
| xml-sitemaps | flag crawl.sitemapGen | XML sitemaps | Generate a sitemap and an image sitemap from the crawl, indexable pages only, split automatically at 50,000 URLs. |
| sitemap-analysis | family sitemaps | Sitemap analysis | Crawl a sitemap on its own or with the site to find URLs that are missing, non-indexable, redirecting, broken or orphaned. |
| custom-robots | flag crawl.customRobots | Custom robots.txt | Edit a copy of the site's robots.txt and test which URLs it would allow or block. |
| amp | family amp | AMP | Find AMP URLs, validate them with the official validator, and check the canonical links in both directions. |
| visualisations | flag crawl.visualise | Visualisations | Directory tree, crawl tree and a force-directed internal-link graph, coloured by indexability and sized by inlinks. |
| structured-data | family structured_data | Structured data | Extract JSON-LD and microdata, catch parse errors, and check required and recommended properties for common schema.org types. |
| spelling | family spelling | Spelling | Spell-check page copy in English, French and German, with your own brand words whitelisted. *(append "Grammar checks run through the AI prompts." when crawl.ai is on)* |
| accessibility | family accessibility | Accessibility | Automated WCAG 2.1 AA checks with the axe-core rule set on every rendered page. |
| ai-prompts | flag crawl.ai | AI prompts | Run up to three prompts per crawl against page content with Claude, OpenAI or Gemini: classify intent, summarise, suggest titles, check grammar. |
| segments | flag crawl.segments | Segments | Group pages by URL pattern, extracted value, depth or status, and filter every table and total by segment. |
| crawl-comparison | flag crawl.compare | Crawl comparison | Diff two crawls: pages added or removed, issues fixed or introduced, element changes, with URL mapping to compare staging against production. |
| scheduling | flag crawl.schedule | Scheduling and reports | Daily, weekly or monthly crawls, results exported to email or Google Sheets, a Looker Studio template that reads them, and a PDF report for every crawl. |
| list-mode | flag crawl.listMode | List mode | Paste or upload a URL list and check status and redirect chains without crawling, for migrations. |
| csv-export | always | CSV export | Every table — issues, pages, duplicates, redirects — exports to CSV. |

Closer (EN): "Every finding is an issue, a warning or an opportunity. Each shows its evidence and how to fix it. Nothing is guessed: a check that can't be read is marked not assessable, not failed."
Closer (FR): "Chaque constat est un problème, un avertissement ou une occasion. Chacun montre sa preuve et comment le corriger. Rien n'est deviné : une vérification impossible à lire est marquée non évaluable, pas échouée."

Write the FR title and body for every row yourself, same meaning, French-Canadian register, "Nosy Bat" untranslated. Technical tokens (`noindex`, `rel="next"`, `target=_blank`, header names, schema.org) stay as-is.

## `CRAWL_FEATURE_ROWS`

The 32 rows from SITE-CRAWLER-PHASE4.md's feature table, in that order, each with the same gate rule as its capability above (rows 2–5, 14, 18 gate on their 3a families; 12, 16, 17, 27 on 3b families; 19 on spelling; the rest on their Phase 4 flags; "Save & open crawls" and "Free technical support" are `always`). Cap cells read from `plan-config.ts`; a ✓ where the feature has no cap.

## `CRAWL_FAQ` (EN; write FR)

1. Does it need an install? — No. Nosy Bat runs on Echorank's servers; you start a crawl from the browser and come back to the results.
2. How many pages can it crawl? — Up to `{cap}` URLs per crawl on `{plan}`, `{cap}` on `{plan}` and `{cap}` on `{plan}` *(from plan-config)*. Larger sites crawl in sections with include patterns.
3. Will it slow my site down? — It identifies itself as Echorank360Bot, obeys robots.txt and stays under two requests a second.
4. Is it included in my plan? — Yes, in every paid plan. Plans differ in caps, not features. No per-user licence.
5. Can my team use it? — Everyone on your Echorank plan sees the same crawls, issues and exports.
6. Does it render JavaScript? *(gated crawl.render)* — Yes, in headless Chromium, for the pages you choose, within your plan's rendered-page cap.
7. What happens to my data? — Crawl data stays in your tenant, is kept for your plan's number of crawls, and is never shared. We store extracted fields, not page HTML.

## Definition of done

- Three commits as named; `tsc` clean; suite green (mega-nav, sitemap, route-table, registry, new page tests); tree clean.
- Report: file map, which capabilities rendered at build time (by id) and the `RULE_COUNT` used, OG image path, screenshot paths, FR rows written, deviations with reasons, and the deploy line (build + `pm2 restart echorank360-web` + Cloudflare Purge Everything — mandatory).
- No deploy without being told.

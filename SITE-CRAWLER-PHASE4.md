# Echorank Site Crawler — Phase 4: Full Paid Feature Set

Repo: /opt/echorank/app. Conventions in CLAUDE.md / AGENTS.md apply. Run as `deploy`. Prerequisite: Phase 3a merged (rule registry in `packages/crawl-rules/`, Issues tab, `crawl_issues.ruleId`). Phase 3b (render mode) is a prerequisite for 4e only.

## Goal

Every paid Echorank plan gets the complete desktop-crawler feature set below. Tiers differ only in caps, never in features. Nothing appears on the public page until it is shipped.

### The 32 features and where each one lands

| # | Feature | Status after Phase 3 | Built in |
|---|---|---|---|
| 1 | Find broken links, errors & redirects | 4xx/5xx/3xx/chains/loops | 4a adds source URLs + bulk export |
| 2 | Analyse page titles & meta data | done (3a) | — |
| 3 | Review meta robots & directives | done (3a) | — |
| 4 | Audit hreflang attributes | done (3a) | — |
| 5 | Discover exact duplicate pages | done (Phase 2) | — |
| 6 | Generate XML sitemaps | — | 4a |
| 7 | Site visualisations | — | 4c |
| 8 | Crawl limit | tier caps | 4a: user-settable max URLs/depth per crawl, under the tier cap |
| 9 | Scheduling | — | 4c |
| 10 | Crawl configuration | start URL only | 4a |
| 11 | Save & open crawls | past-crawls list | 4a: retention per tier, reopen any kept crawl |
| 12 | JavaScript rendering | 3b | — |
| 13 | Crawl comparison | — | 4c |
| 14 | Near duplicate content | done (3a simhash) | — |
| 15 | Custom robots.txt | — | 4a |
| 16 | Mobile usability | 3b mobile family + PSI mobile | 4d joins PSI mobile scores |
| 17 | AMP crawling & validation | — | 4e |
| 18 | Structured data & validation | done (3a) | — |
| 19 | Spelling & grammar | spelling (3c) | 4e: grammar via AI prompts (opt-in, metered) |
| 20 | Custom source code search | — | 4b |
| 21 | Custom extraction | — | 4b |
| 22 | Custom JavaScript | — | 4e |
| 23 | Crawl with AI (Claude / OpenAI / Gemini) | — | 4e |
| 24 | Google Analytics integration | — | 4d (GA4) |
| 25 | Search Console integration | GSC Insights tool exists | 4d joins onto crawl rows |
| 26 | PageSpeed Insights integration | Lighthouse tool exists | 4d joins onto crawl rows |
| 27 | Accessibility auditing | 3b (axe-core) | — |
| 28 | Link metrics integration | — | 4d (DataForSEO backlinks) |
| 29 | Forms-based authentication | — | 4e |
| 30 | Segmentation | — | 4b |
| 31 | Looker Studio crawl report | — | 4c (Sheets export + template) + PDF report |
| 32 | Free technical support | support@echorank360.com, /kb, in-app Help | 4f lists it |

### Tier caps (the only thing that differs between paid plans)

| Cap | STARTER | GROWTH | AGENCY |
|---|---|---|---|
| URLs per crawl | 2,500 | 5,000 | 25,000 |
| Crawls per month | 4 | 20 | unlimited |
| Rendered pages per crawl (3b) | 100 | 500 | 5,000 |
| Crawls kept (full data) | 3 | 10 | 50 |
| Extractors / searches per crawl | 3 / 2 | 5 / 5 | 10 / 5 |
| Segments | 3 | 10 | 25 |
| Schedules (cadence) | 1 (monthly) | 2 (weekly, monthly) | 10 (daily, weekly, monthly) |
| AI-prompted pages per crawl | 20 | 100 | 500 |
| PSI pages per crawl | 10 | 50 | 100 |
| Backlink lookups per crawl | 10 | 50 | 100 |
| Custom JS snippets | 1 | 3 | 5 |

All keys live in `plan-config.ts` beside `crawlUrlCap`. The 3b spec's "STARTER 0 rendered pages" is superseded by this table.

Deliver in six sub-phases, one CC session each, one commit per feature (small writes, commit often). Stop after each sub-phase and report. No deploy without being told.

## Phase 0 — investigate first (no edits)

1. Confirm Phase 3a state: registry path, `crawl_issues` columns, Issues tab, `crawl_jobs.summary` shape.
2. Locate: `crawlOne`/`parsePage` (`src/lib/site-crawler/checks.ts`, `runner.ts`), `fetch.ts`, `robots.ts`, the Redis frontier, `quota.ts`, `plan-config.ts`, `site-crawl.worker.ts`, the SERP poller's repeatable-job prune (numeric `every` fix), the GSC OAuth client + `GscQueryStat` + `GSC_TOKEN_ENCRYPTION_KEY` pattern, the Lighthouse/PSI tool + quota, the DataForSEO client + `SeoApiCall` metering + USD cap, the Marketing Studio token meter, the av-visibility sidecar PDF framework (`pdf_report.py`), `csv-export.ts`.
3. Print the file map and stop if anything is missing.

## Shared constraints

- Memory-first: no page set in RAM; aggregation in SQL. Every new table gets a retention rule.
- SSRF guard (`bot-analytics/url-guard.ts`) on every user-supplied URL: list mode, URL mapping, login URLs, sitemap exclusions.
- Secrets at rest (login passwords, BYO API keys, cookies, basic-auth) encrypted with the `GSC_TOKEN_ENCRYPTION_KEY` pattern; never logged, never in CSV, never echoed to the UI after save.
- Site ownership: features that change how the crawler treats the target site (ignore robots.txt, forms-based login, custom JS) require a **verified site**: GSC property connected for that host, or a `<meta name="echorank-verify">` token, or a DNS TXT token. Unverified sites get the read-only versions (robots.txt test mode, no login, no JS). The Echorank360Bot UA, robots compliance and 2 req/s stay the default everywhere.
- Dashboard UI = light Tailwind (Card/Button/Input). Public page = Binance tokens, "Echorank" branding only, CTAs → `/pricing`.
- Tests table-driven per feature; `tsc` clean; suite green; route-table test updated.

---

## Phase 4a — crawl configuration, link graph, list mode, sitemaps, retention

**Crawl configuration** (`crawl_jobs.config jsonb`, a typed `CrawlConfig`): max URLs (≤ tier cap), max depth, include/exclude URL patterns (glob or regex, ≤ 20 each), crawl subdomains (bool), follow nofollow (bool), query-string handling (keep | strip all | strip listed params), speed (0.5–2 req/s), user-agent (Echorank360Bot default; Googlebot-smartphone / Googlebot-desktop / custom string on verified sites only), custom request headers (≤ 10, values encrypted), cookies (one header string, encrypted), HTTP basic auth (user + password, encrypted), respect robots.txt (bool — **false only on verified sites**), custom robots.txt (textarea). Start card gets a collapsible "Configuration" section with sensible defaults and a "Save as default for this site" toggle (`crawl_site_defaults` per tenant+host).

**Custom robots.txt.** On a verified site the supplied file replaces the live one for the crawl. On an unverified site it runs in test mode: the crawl obeys the live file, and a `robots.would_block` / `robots.would_allow` pair of informational rules (family `robots`, reserved in `RULE_FAMILIES` by 3a) reports what the custom file would have changed. Both modes also produce a **robots.txt tester** panel: paste URLs, see allow/block per rule line for live vs custom.

**Link edges.** New table `crawl_links` (crawlJobId, fromPageId, toPageId nullable, toUrl, anchor ≤ 200, nofollow bool, position smallint). Internal links only, deduped per (from, to), capped 100 per page. Indexes (crawlJobId, toPageId), (crawlJobId, fromPageId). `crawl_pages` gains `foundOn` (first referrer) and `parentPageId` (BFS discoverer) and `redirectChain jsonb` (every hop {url, status}).

**Broken links with sources.** Pages tab and response_codes rules show "Found on"; per-page Inlinks panel lists every referrer with anchor text; export `?format=csv&view=broken-links` = one row per (source URL, broken URL, anchor, status). Redirects export gains every hop.

**List mode.** `crawl_jobs.mode: 'spider' | 'list'`. Pasted URLs or `.txt`/`.csv` upload (first column), ≤ tier cap, no discovery, each URL fetched with the full redirect chain recorded. Any host allowed in list mode (it is a status check, not a crawl). Start card: Spider / List toggle.

**Sitemap generator.** On a completed crawl: indexable 200 HTML only (default), lastmod source (Last-Modified header | crawl date | none), changefreq + priority (fixed or by depth), exclude patterns; `sitemap.xml` split at 50,000 with an index; optional `image-sitemap.xml` from `<img>` srcs (add `imgSrcs text[]` capped 50 per page). Streamed from SQL, zipped, downloaded; nothing stored.

**Save & open crawls / retention.** Every crawl keeps its `crawl_jobs` row and summary forever (history list). Full data (pages, issues, links, extractions, metrics) is kept for the N most recent completed crawls per tenant (N = tier cap) plus any crawl the user pins (`pinned bool`, ≤ 5 per tenant). A nightly job deletes the rest in batches of 5,000 rows. Any kept crawl reopens from the Past crawls list with every tab.

**Graph endpoint** (consumed in 4c): `GET /api/seo/v1/crawl/[id]/graph?kind=directory|crawl-tree|links&limit=2000`.

Migration: `site_crawler_phase4a_config_links` (a normal migration file; see Definition of done).

---

## Phase 4b — custom extraction, custom search, segmentation

**Extraction.** Per crawl up to N extractors (tier cap): `{name, kind: 'css'|'xpath'|'regex', expr, attr?, multiple}`. CSS via cheerio on the already-parsed document; XPath via `xpath` + `@xmldom/xmldom` on the already-fetched HTML (no re-fetch); regex with a linear-time guard (`re2` if it installs on the box, else `safe-regex2` rejection + 50 ms per-page timeout). Expr ≤ 500 chars. Presets: OG tags, product price/SKU, author/date, hreflang, canonical. Storage `crawl_extractions` (crawlJobId, pageId, extractorIndex, values text[] capped 20 × 500). New **Extraction** tab: URL + one column per extractor, has-value/empty filter, CSV.

**Custom search.** Up to N searches `{name, pattern, isRegex}` against raw HTML; `crawl_pages.searchHits jsonb` ({index: count}); column + filter on Pages; CSV.

**Segmentation.** Per tenant+host up to N segments `{name, rule: urlPattern | extractorIndex=value | depth<=n | statusClass}` stored in `crawl_segments`; each page gets `segmentIds smallint[]` at crawl time (evaluated inline, cheap). Every tab gets a segment filter; Overview shows issue totals per segment; Compare (4c) diffs per segment. CSV exports carry a `segment` column.

Registry: `extraction` family — `extraction.empty` (opportunity), `search.match` (warning).

Migration: `site_crawler_phase4b_extraction_segments`.

---

## Phase 4c — visualise, compare, schedule, reports

**Visualise.** **Structure** tab, three views from the 4a graph endpoint, client-side `d3-hierarchy` + `d3-force`: directory tree (collapsible), crawl tree (BFS parent), force-directed internal-link graph (≤ 2,000 nodes, colour = indexable / non-indexable / error, size = inlinks, hover = URL + inlinks + depth, click = filter Pages). SVG/PNG export client-side. Lazy-loaded.

**Compare.** **Compare** tab: pick two completed crawls (default: this and the previous of the same host). SQL set operations only: pages added / removed / changed (status, title, canonical, indexability), issues new / resolved per `ruleId`, summary deltas, per segment. Optional URL mapping `{find: regex, replace}` pairs applied before matching (staging → production). `crawl_comparisons` (jobAId, jobBId, mapping, result jsonb ≤ 1 MB: counts + first 500 URLs per bucket; full lists paged). CSV per bucket.

**Schedule.** `crawl_schedules` (tenantId, host, config, cadence, hourUtc, nextRunAt, lastJobId, enabled, exportTo jsonb). BullMQ repeatable per schedule, numeric prune on worker start. Each run = normal `crawl_jobs` row, counts against monthly quota, auto-Compare against `lastJobId` on completion. Auto-export targets: email with CSV links (Brevo); Google Sheets (see below).

**Google Sheets export + Looker Studio.** Add the `spreadsheets` scope to the existing Google OAuth client (print the consent-screen step for the operator; if it needs a re-review, ship email export first and flag TODO(fred)). On completion a schedule (or a manual "Export to Sheets" button) writes four tabs — Summary, Issues, Pages, Compare — to a tenant-owned spreadsheet, appending one row per crawl to Summary. Publish a Looker Studio template that reads that spreadsheet layout; link it from `/kb` with a "Make a copy → pick your sheet" guide. This is feature #31.

**PDF crawl report.** Reuse the sidecar's `pdf_report.py` framework: `POST /crawl-report` (secret-gated) → app route `/api/seo/v1/crawl/[id]/report` (requireTenant, paid) → `ReportDownloadButton` on the crawl header. Sections: summary, issue totals by kind/family, top 20 issues, per-segment table, compare deltas when available.

Migration: `site_crawler_phase4c_compare_schedule`.

---

## Phase 4d — GSC, PSI, GA4 and link metrics joined onto crawl rows

Storage for all four: `crawl_page_metrics` (crawlJobId, pageId, source enum gsc|psi|ga4|backlinks, data jsonb). Pages tab gains sortable columns per source; CSV carries them. Retention follows the crawl.

- **GSC.** When the tenant's GSC connection covers the host: page-level clicks / impressions / CTR / position for the last 28 days (Search Analytics, `dimensions: ['page']`, paged), joined on normalised URL. Registry family `search_console` (`requires: ['gsc']`): `gsc.indexed_zero_impressions` (opportunity), `gsc.traffic_low_inlinks` (warning), `gsc.traffic_noindex` (issue).
- **PSI.** Opt-in on the start card: top N pages by inlinks (tier cap), mobile + desktop, charged to the Lighthouse tool quota. The 3c performance rules read from here. Mobile usability score surfaces on the `mobile` family.
- **GA4.** Add `analytics.readonly` to the Google OAuth client (operator step printed). Tenant picks a GA4 property; per landing page over the last 28 days: sessions, users, engagement rate, conversions (key events). Family `analytics` (`requires: ['ga4']`): `ga4.crawled_zero_sessions` (opportunity), `ga4.converting_page_has_issues` (warning: a page with conversions carries any high-priority issue).
- **Link metrics.** Opt-in: top N pages by inlinks, DataForSEO Backlinks summary per URL (referring domains, backlinks, rank), metered through `SeoApiCall` and the tenant USD cap — the crawl stops requesting when the cap is hit and says so. Family `backlinks` (`requires: ['backlinks']`): `backlinks.page_with_links_is_broken` (issue), `backlinks.page_with_links_redirects` (warning).

Migration: `site_crawler_phase4d_metrics`.

---

## Phase 4e — render-dependent features (requires Phase 3b)

- **AMP.** Detect `<link rel="amphtml">`; crawl AMP URLs; validate with the official `amphtml-validator` package in the worker. Family `amp`: amphtml link to non-200, invalid AMP (with error count), AMP missing canonical, AMP canonical mismatch, non-AMP page linked as AMP, AMP page not in sitemap.
- **Custom JavaScript.** Verified sites only. Up to N snippets (tier cap) run in the sidecar's page context after render (`page.evaluate`), 5 s timeout, return value serialised ≤ 5 KB, stored as an extractor result (`kind: 'js'` in `crawl_extractions`). Presets: scroll to bottom, click "load more", read `dataLayer`, read `window.__NEXT_DATA__` keys.
- **Crawl with AI.** Up to 3 prompts per crawl run against the visible text of the top N pages (tier cap; by inlinks or by segment): classify intent, summarise, suggest title/description, grammar check (feature #19's grammar half), custom prompt. Providers: Claude via the house key charged to the Marketing Studio token meter; OpenAI and Gemini via tenant BYO keys (encrypted). Output stored as an extractor result (`kind: 'ai'`), columns on the Extraction tab, CSV. Family `ai`: `ai.suggested_title_differs` (opportunity), `ai.grammar_issues` (warning).
- **Forms-based authentication.** Verified sites only. Config: login URL, username selector, password selector, submit selector, success check (URL or selector), credentials encrypted. The sidecar performs the login once per crawl, exports the session cookies, and the raw fetcher reuses them for every request; render mode reuses the context. Never crawls logout links (pattern list + `rel=nofollow` on logout). Basic auth (4a) covers the non-form case.

Migration: `site_crawler_phase4e_render_features`.

---

## Phase 4f — public page and in-app copy

Build `/[locale]/site-crawler` (route-handler pattern à la `/technical-geo`, en + fr, Binance tokens, FAQPage JSON-LD, `LOCALIZED_ROUTES` at 0.7, linked from Solutions › By goal and the SEO Tools hub card). Hero → twelve capability cards → full 32-row feature table with **four columns — Free, Starter, Growth, Agency** — and their caps. The Free column is filled only where an existing free tool covers the feature (name and link the tool, e.g. the free site audit or robots checker under `/free-tools`); every other Free cell is a dash, never a tick for something the free tools do not do → "Hosted, not installed" block, **led by pricing per workspace, not per user**: one plan covers the tenant's whole team, where desktop crawlers sell a licence per user (or per machine). Read the seat rule from `plan-config.ts`, never hardcode it; today there is no seat cap (team invites are unlimited), so the copy says "your whole team", and it must change in the same commit if a cap is ever added. Then: no desktop app, scheduled, team-shared, API → pricing strip from `PLAN_CONFIGS` → FAQ. CTAs → `/pricing`. Screenshots by Playwright from the dogfood tenant's crawl of echorank360.com.

**Gating:** every card and table row is keyed to a feature flag (`crawl.<feature>`) and renders only when the flag is on in production. The page never lists a capability that isn't shipped. Row 32 ("Free technical support") is always on.

**Card copy (EN source of truth; FR by the builder). Original wording — never reuse a vendor's text.**

1. **Find broken links** — Every 404 and server error, with the page it was found on and the anchor text that points to it. Export the list and hand it to whoever fixes it.
2. **Audit redirects** — Every 301, 302 and chain, hop by hop. Paste or upload a URL list to check a migration before and after it goes live.
3. **Review titles and descriptions** — Every title and meta description measured in characters and pixels: missing, too long, too short, or repeated across the site.
4. **Find duplicate and thin content** — Exact duplicates by content hash, near-duplicates by similarity, repeated titles, descriptions and headings, and pages too thin to rank.
5. **Extract any data** — Prices, SKUs, authors, dates, social tags or anything else, with CSS selectors, XPath, a regular expression or your own JavaScript. Search every page's source for a string.
6. **Check robots and directives** — URLs blocked by robots.txt, noindex and nofollow in meta robots or X-Robots-Tag, canonicals, pagination tags, hreflang, and the conflicts between them. Test a new robots.txt before you publish it.
7. **Generate XML sitemaps** — A sitemap and an image sitemap from the crawl: indexable pages only, your choice of lastmod, priority and exclusions, split at 50,000 URLs.
8. **Add Search Console, Analytics, PageSpeed and backlink data** — Clicks, impressions and position; sessions and conversions; Core Web Vitals; referring domains — on the same row as each crawled URL.
9. **Crawl JavaScript sites** — Render pages in headless Chromium to crawl React, Vue, Angular and other client-rendered sites, and see what exists only after JavaScript runs. Crawl behind a login when it's your site.
10. **See the site's structure** — Directory tree, crawl tree and an internal-link graph that shows depth, orphans and the pages that carry the most links. Slice everything by segment.
11. **Crawl on a schedule** — Daily, weekly or monthly, results exported to email or Google Sheets, every run compared with the last, a Looker Studio template ready to connect.
12. **Compare crawls and staging** — What changed between two crawls: pages added or removed, issues fixed or introduced. Map staging URLs to production to audit a release before it ships.

In-app: the SEO Tools hub card gets the same one-liner; `/kb` gets one article per capability from the same copy source (`src/lib/site-crawler/marketing-copy.ts`, typed, en/fr); the FAQ page's "Tools & Usage" gains the crawler caps table.

---

## Definition of done (every sub-phase)

- Migration: a normal file under `prisma/migrations/`, SQL generated with `prisma migrate diff --from-schema <old> --to-schema prisma/schema.prisma --script`, applied only by `sudo echorank360-deploy` (`prisma migrate deploy`) — never by hand. Guarded statements (`IF NOT EXISTS`, `DO` blocks for types) so a retry is a no-op. Name in the commit message.
- Retention job for every new table; encryption for every secret; verified-site check on every feature marked as such.
- `tsc` clean, suite green, tree clean, one commit per feature.
- Report: features shipped, tables + retention, plan-config keys, operator steps (OAuth scopes, consent screen), tests before/after, commit hashes, deviations with reasons, the exact deploy line (both pm2 processes, CF Purge Everything after a successful build, sidecar first when touched).
- No secrets in output. No deploy without being told.

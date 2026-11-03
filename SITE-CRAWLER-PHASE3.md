# Echorank Site Crawler — Phase 3: Issue Library (Screaming Frog parity)

Repo: /opt/echorank/app (Next.js 16 App Router, Prisma, BullMQ in `echorank360-workers`, av-visibility Python sidecar on :4500 with Playwright). Conventions in CLAUDE.md / AGENTS.md apply. Run as `deploy`.

## Goal

Turn the Site Crawler (Phase 1+2, Aug 5: `crawl_jobs` / `crawl_pages` / `crawl_issues`, 7 issue types, 5 tabs at `/visibility/tools/site-crawler`) into a rule-driven issue library at Screaming Frog scale: ~300 named checks across links, redirects, titles/meta, headings, content, duplicates, images, canonicals, directives, hreflang, pagination, structured data, security, validation, JS rendering, accessibility, spelling.

Deliver in three sub-phases, one CC session each, each independently shippable. Stop after 3a and report; do not start 3b until told.

## Where it lives (decided)

- **Crawl loop, storage, quotas, UI stay in Echorank** (Phase 1+2 already run there; the Site Crawler is an Echorank tool).
- **The rule engine is an independent module**: `packages/crawl-rules/` inside this repo, with its own `package.json` + `tsconfig`, consumed by the app via a workspace entry or path alias. It takes `PageFacts`/`SiteFacts` in and returns `Issue[]`; it imports nothing from `src/`, Prisma, Next, or Node `fs`/`net` (a registry test enforces this). It is written so it can be moved to its own repo and consumed by EchoPilot and llms.txt Studio unchanged.
- **EchoPilot does not get its own copy of the crawler.** It consumes crawls through Echorank's public API (it already holds an `ECHORANK_API_KEY` for the AI-visibility rules) — see Phase 3d.

## Phase 0 — investigate first (no edits)

1. Locate the crawler: worker job, `crawlOne`/`parsePage`, aggregation job, the `crawl_issues` Prisma model, the 7 existing issue types, API routes, the 5-tab UI, i18n keys in the 3 app catalogs, existing tests.
2. Print a file map + the current `CrawlPage` fields + the current issue enum. If the crawler module cannot be found, STOP and report.
3. Confirm `src/lib/csv-export.ts` and `bot-analytics/url-guard.ts` (SSRF guard) are the ones in use.

## Architecture (all phases)

**Rule registry** — `packages/crawl-rules/src/rules/<family>.ts`, each exporting `Rule[]`:

```ts
type Rule = {
  id: string;                      // stable, dotted: "titles.over_60"
  family: RuleFamily;              // enum below
  kind: 'issue' | 'warning' | 'opportunity';
  priority: 'high' | 'medium' | 'low';
  scope: 'page' | 'site';          // page = inline in crawlOne; site = aggregation job (SQL groupBy)
  requires?: ('render' | 'psi' | 'spell')[];  // skipped when the capability isn't enabled for the job
  detect: (page: PageFacts, ctx: RuleCtx) => Evidence | null;
};
```

- `packages/crawl-rules/src/index.ts` = the single registry (also drives the UI, CSV, and later a public issue library page). Rule copy (`name`, `description`, `howToFix`, EN) ships inside the package as data keyed by rule id; the app's 3 i18n catalogs reference those keys (FR/DE may fall back to EN in this phase). Add a test that every rule id is unique and dotted, every rule has copy, and the package has no forbidden imports.
- `PageFacts` and `SiteFacts` are plain serialisable types defined in the package; the Echorank worker maps `CrawlPage` rows to them. Any consumer that can produce `PageFacts` (EchoPilot's own 60-page crawl, llms.txt Studio) gets the same verdicts.
- Page-scope rules run inline on the already-parsed page; no second parse, no HTML body stored (Phase 1 rule stands). Add only the extra `PageFacts` columns listed per phase. Site-scope rules run in the existing aggregation job via groupBy; never load the page set into RAM.
- The 7 existing issue types are migrated to rule ids (keep a mapping so old rows still render).

**Schema** (migration via `prisma migrate diff` → `psql` → `prisma migrate resolve --applied`; the DB user cannot create a shadow DB, `migrate dev` fails):

- `crawl_issues`: add `ruleId text`, `kind`, `priority`, `evidence jsonb` (small: counts, lengths, the offending value truncated to 200 chars). Index `(jobId, ruleId)`.
- `crawl_pages`: new columns per phase (below). Keep rows narrow; arrays only where listed.
- `crawl_jobs.summary` JSON gains `issues: {ruleId: {count, kind, priority}}` and totals by kind.
  **Old jobs (from the live page):** `summary` is null for pre-Phase-2 jobs, and Phase 2 jobs
  have a summary with no `issues` / kind totals. Either backfill both in the 3a migration, or
  have the Overview cards and the Issues tab compute from `crawl_issues` (groupBy `ruleId`, kind;
  legacy rows through the 7-type mapping) whenever `summary` is null or has no `issues`. Never
  render zeroes for a job that simply predates the field.

**UI** — new **Issues** tab, Screaming Frog layout: one row per rule → Issue · Kind · Priority · URLs · % of crawled; click → filtered Pages list for that rule; side panel shows description + how to fix. Overview tab gets issue/warning/opportunity totals. Existing 5 tabs unchanged. CSV export of the issues table and of the per-rule page list via `csv-export.ts` + `?format=csv` on the list route. Light Tailwind dashboard theme (Card/Button/Input), not the marketing tokens.

**Gating** — same `requirePaidPlan` as today. Rule evaluation adds no external cost, so no new quota in 3a. Render mode (3b) is per-tier: STARTER 0 rendered pages, GROWTH 500 / crawl, AGENCY 5,000 / crawl, keyed in `plan-config.ts` next to the crawl URL caps (500 / 5,000 / 25,000).

**Tests** — table-driven: one fixture-HTML test per rule (positive + negative). `tsc` clean, full suite green, route-table test updated if a route is added.

---

## Phase 3a — static rule families (no sidecar changes) · target ≈ 140 rules

New `PageFacts` columns: `h2Count`, `h2First`, `imgMissingAltCount`, `imgCount`, `canonicalHeader`, `xRobotsTag`, `hreflang jsonb` (array of {lang, href}), `relNext`, `relPrev`, `responseMs`, `bytes`, `textRatio`, `langAttr`, `hasViewport`, `securityHeaders jsonb` ({hsts,csp,xcto,xfo,refpol} booleans), `mixedContentCount`, `insecureFormCount`, `externalOutlinks`, `internalOutlinks`, `nofollowOutlinks`, `jsonLdTypes text[]`, `jsonLdErrors int`, `simhash bigint` (64-bit over visible text shingles).

Families and rule set (name each rule exactly; ids are stable API):

1. **response_codes** — internal 4xx, internal 5xx, external 4xx, external 5xx, no response/timeout, internal 3xx, redirect chain (>1 hop), redirect loop, meta refresh, redirect to 4xx/5xx, blocked by robots.txt, inlinks pointing at a 3xx.
2. **url** — non-ASCII characters, underscores, uppercase, parameters, over 115 chars, multiple slashes, repetitive path segments, contains space, internal search parameter, non-canonical trailing-slash variant found.
3. **page_titles** — missing, duplicate (site), over 60 chars, under 30 chars, over 561 px, under 200 px (width estimate via per-char table), same as H1, multiple titles, outside `<head>`.
4. **meta_description** — missing, duplicate (site), over 155 chars, under 70 chars, over 985 px, multiple, outside `<head>`.
5. **meta_keywords** — present (opportunity: remove).
6. **h1** — missing, duplicate (site), over 70 chars, multiple, same as another page's H1 (site), empty.
7. **h2** — missing, duplicate (site), over 70 chars, multiple identical on page, non-sequential (H3 before H2), empty.
8. **content** — low word count (<200), exact duplicate (contentHash, site), near duplicate (simhash Hamming ≤ 3, site), readability difficult (Flesch < 50, en only), placeholder text (lorem ipsum / "coming soon" / "under construction"), soft 404 (200 with "not found/404" title or <50 words), text ratio < 10 %, missing `lang` attribute.
9. **images** — missing alt, alt over 100 chars, missing width/height attributes, broken image (from frontier results, same-host only), over 100 KB (HEAD `content-length`, same-host, cap 20 HEADs/page), alt equals filename, image count > 50.
10. **canonicals** — missing, canonicalised (points elsewhere), multiple, canonical to 3xx, canonical to 4xx, canonical to noindex page, relative canonical, header vs HTML mismatch, outside `<head>`, canonical to non-HTTPS from HTTPS page.
11. **directives** — noindex, nofollow, none, noarchive, nosnippet, max-snippet, noimageindex, notranslate, unavailable_after, noindex + canonical conflict, noindex + in sitemap, outside `<head>`, X-Robots-Tag vs meta conflict.
    **Kinds (from the live page):** the nine "present" rules (`directives.noindex` …
    `directives.unavailable_after`) are `kind: 'warning'`, not `'issue'`. A directive being
    there is a deliberate choice as often as a mistake. The conflict and placement rules
    stay `'issue'`. Assert the kinds in the registry test.
12. **links** — high external outlinks (>100), high internal outlinks (>500), no internal outlinks, inlinks only via nofollow, non-descriptive anchor text ("click here", "read more", "here", "link"), localhost/127.0.0.1 links, internal nofollow, outlinks to redirect, internal links with parameters, only one inlink, crawl depth > 3, orphan (sitemap-only — existing).
13. **sitemaps** — in sitemap not in crawl (existing), in crawl not in sitemap, non-indexable URL in sitemap, 3xx in sitemap, 4xx in sitemap, sitemap missing, sitemap over 50k URLs or 50 MB, sitemap not in robots.txt.
14. **security** — HTTP URL, mixed content, form on HTTP, `target=_blank` without `rel=noopener`, missing HSTS, missing CSP, missing X-Content-Type-Options, missing X-Frame-Options, missing Referrer-Policy, protocol-relative resource, bad content-type for HTML.
15. **hreflang** — missing return links (site), inconsistent language (site), non-200 hreflang URL, unlinked hreflang URL, missing self-reference, not using canonical, invalid language/region code (ISO 639-1 / 3166-1), multiple entries for one lang, missing x-default, outside `<head>`, hreflang to noindex page, no hreflang on a multilingual site (≥ 2 `lang` values seen).
16. **pagination** — rel next/prev to non-200, sequence error, paginated URL not in anchor, multiple pagination URLs, outside `<head>`, non-first page canonicalised to first.
17. **structured_data** — JSON-LD parse error, microdata present but unparsable, no structured data, non-schema.org type, missing required property per type (table: Organization name+url · LocalBusiness name+address · Product name+offers · Article headline+author+datePublished · FAQPage mainEntity · BreadcrumbList itemListElement · WebSite name+url · Event name+startDate+location), missing recommended property per type, duplicate blocks, type on a page where it never makes sense (Product on a contact page is NOT flagged — keep it to parse/required/recommended only).
18. **validation** — missing doctype, element in `<head>` that belongs in `<body>`, `<body>` before `<head>` content, multiple `<html>`/`<body>`, `<head>` not first child, viewport missing.

Also in 3a: migrate the 7 existing types to the registry; Issues tab; CSV; summary; tests; `npm run test` green; commit. Do NOT deploy; report rule count, migration name, test count, commit hash, and any family you dropped or renamed with the reason.

---

## Phase 3b — render mode + accessibility + JavaScript rules · ≈ +100 rules

- Sidecar: add `POST /render` (X-Internal-Secret gated like `/audit`; reuse the AI Lens Playwright code path): returns rendered HTML, console errors, axe-core results (`axe-core` injected, WCAG 2.1 AA tags), rendered screenshot omitted. One Chromium at a time; 20 s hard timeout; queue depth 1 per job.
- Job option `renderMode: 'none' | 'thin' | 'all'` — `thin` = re-fetch via `/render` only pages whose raw-HTML word count < 50 or where raw HTML has no `<a>`; capped by the per-tier rendered-page quota above.
- New `PageFacts`: `renderedWordCount`, `renderedLinkCount`, `jsOnly jsonb` ({title, metaDesc, h1, canonical, content, links} booleans), `axeViolations jsonb` (ruleId → nodes count; no HTML snippets stored), `consoleErrors int`.
- **javascript** family — content only in rendered DOM, links only in rendered DOM, title/meta/H1/canonical changed by JS, noindex only in original HTML, noindex only in rendered HTML, JS redirect, page uses old AJAX crawling scheme (`#!`), rendered word count 0, console errors present, `jsOnly.links` with `renderMode=none` (opportunity: enable rendering).
- **accessibility** family — one rule per axe-core rule id (`a11y.<axe-rule-id>`, ~90), kind from axe `impact` (critical/serious → issue, moderate → warning, minor → opportunity). Names/descriptions generated from axe's rule metadata at build time into the i18n EN catalog (script, committed output), not hand-typed.
- **mobile** family (render only) — viewport missing (duplicate of validation; keep one), content wider than viewport, font-size too small (axe/lighthouse-free heuristic: computed body font < 12 px), tap targets too close (skip if not cheap).
- Deploy order: sidecar restart BEFORE app build + restart (both pm2 processes) + CF purge.

---

## Phase 3c — spelling, PSI opportunities, public library · ≈ +40 rules

- **spelling** — spelling only (no grammar): `nspell` + hunspell dictionaries for en, fr, de (the 5 locales fold to these three); language from `langAttr`, fallback job default; whitelist from tenant settings (brand names). Rules: misspellings present, > 5 misspellings, unsupported language (opportunity). Grammar (LanguageTool, Java, ~2 GB RAM) is explicitly out of scope on this VPS — note it as a deferred decision, do not install.
- **performance** opportunities — only when the job has PSI data attached via the existing Lighthouse/PSI integration: ~15 Lighthouse audits mapped to opportunity rules (render-blocking resources, unused CSS/JS, unsized images, LCP > 2.5 s, CLS > 0.1, INP > 200 ms, large network payload, text compression, image formats, caching, redirects, server response > 600 ms). Gate behind the Lighthouse tool's quota; no new PSI spend.
- Public issue library: `/[locale]/seo-spider/issues` (route-handler pattern, Binance tokens, generated from the registry — one anchor per rule with description + how to fix, FAQ-free). Add to `LOCALIZED_ROUTES` registry (sitemap 0.6) and the Resources › Learn column. This is the SEO-content equivalent of Screaming Frog's /seo-spider/issues/ page.

---

## Phase 3d — EchoPilot as a consumer (separate repo, separate CC session; design only here)

- Echorank public API: `POST /api/public/v1/crawl` (start, same tier caps, metered like other public endpoints), `GET /api/public/v1/crawl/{id}` (status + summary), `GET /api/public/v1/crawl/{id}/issues?ruleId=` (paged). Bearer key, tenant-scoped, 60 req/min Redis limit — same auth path as `/api/public/v1/keywords/suggest`. MCP server gains `start_crawl` / `get_crawl_issues`.
- EchoPilot (`/opt/echopilot`): the Website-foundation (W*) and Technical-SEO (S*) rules can read an Echorank crawl instead of EchoPilot's own 60-page pass when `ECHORANK_API_KEY` is set, lifting the 60-page cap on paid tiers; the 92-rule verdict stays EchoPilot's, the 300-rule detail is Echorank's. EchoPilot never shows the Screaming Frog-style issue table — owners get the 8 fixes, agencies get the table in Echorank.

---

## Definition of done (every sub-phase)

- Registry test passes (unique ids, i18n keys present, every rule has ≥ 1 positive + 1 negative fixture test).
- `tsc` clean, full suite green, tree clean, one commit per sub-phase with the migration name in the message.
- Report back: rule count by family, columns added, tests before/after, commit hash, deviations with reasons, the exact deploy line (per CLAUDE.md: both pm2 processes, CF Purge Everything after a successful build, sidecar first when touched).
- No secrets in output. No deploy without being told.

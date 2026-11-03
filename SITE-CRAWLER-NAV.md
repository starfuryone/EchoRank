# Echorank — Nosy Bat™ gets its own place in the app

Repo: /opt/echorank/app. Conventions in CLAUDE.md / AGENTS.md apply. Run as `deploy`. One session, one commit. No deploy without being told.

Prerequisite: SITE-CRAWLER-BRANDING.md committed (`CRAWLER_BRAND` in `src/lib/site-crawler/brand.ts`). If missing, STOP and report.

## Why

Today the crawler lives at `/visibility/tools/site-crawler`, under the "AI Visibility" page header, reached through the SEO Tools hub. It is a separate crawler with its own brand and must read as one: its own sidebar entry, its own route, its own header. The AI Visibility auditor keeps its place untouched.

## Phase 0 — investigate (no edits)

Locate: the dashboard sidebar config (the component that renders Dashboard / AI / SEO Tools / Marketing Studio / Reputation Tools and filters by plan), the `(dashboard)` layout that sets the top-bar title ("AI Visibility" on `/visibility/*`) and how that title is derived, `plan-routing.ts` (route allowlists per plan), `src/lib/seo-tools.ts` (the hub card for `site_crawler`), the page at `src/app/(dashboard)/visibility/tools/site-crawler/page.tsx` and its client components, the nav-registry / route-table tests, the help-hub `pageHelp` route→slug map, and the summary-card code path on the crawl header (the cards reading Errors / Warnings / Notices). Print the file map.

## Tasks

### 1. Route

- New route `src/app/(dashboard)/crawler/page.tsx` (and `[id]` if the current page uses one) rendering the existing client components unchanged. Move, don't copy: `git mv` the page files, then leave a `page.tsx` at the old path that `permanentRedirect`s to `/crawler` (preserving the `?` query and any `[id]`).
- API routes under `/api/seo/v1/crawl/*`, the tool key `site_crawler`, Prisma models, queue names: **unchanged**.
- Add `/crawler` to every place `/visibility/tools/site-crawler` is allowlisted: `plan-routing.ts`, `requirePaidPlan` layout coverage (the new route must sit under the same paid-plan guard — add a `layout.tsx` under `/crawler` that applies it exactly as the tools layout does), the route-table test, the nav-registry test, the help-hub `pageHelp` map (same slug).

### 2. Sidebar

- New WORKSPACE entry **Nosy Bat** between "SEO Tools" and "Marketing Studio", icon = `CRAWLER_BRAND.mark` rendered at the same size as the other sidebar icons (the sidebar uses icon components; wrap the SVG as an `<img>` with `aria-hidden`, or an inline `<svg>` component generated once from the file — pick whichever the sidebar's icon slot already accepts, and say which). Href `/crawler`. Same plan filter as SEO Tools (paid plans only). Active state when the path starts with `/crawler`.
- Translations: the label "Nosy Bat" is not translated; the `title`/tooltip is "Site crawler" / "Robot d'exploration" / "Site-Crawler".

### 3. Header

- The top-bar title on `/crawler/*` is **Nosy Bat** with the byline `crawler by Echorank` in the secondary style the header already uses for subtitles (if it has none, add the byline as a small muted span after the title, 12 px, no new component). The `<title>` is "Nosy Bat — Echorank".
- On the page itself, the "SITE CRAWLER" eyebrow becomes the lockup `CRAWLER_BRAND.logoOnLight` at 40 px height, followed by the existing description line. No duplicate name in text under the lockup.

### 4. SEO Tools hub

The hub keeps its card (title "Nosy Bat", subtitle "Site crawler", mark icon — from the branding task) but its href becomes `/crawler`. Nothing else in the hub changes.

### 5. Fix: header summary cards

On a fresh Phase 2 crawl the header cards show Errors 0 / Warnings 0 / Notices 0 while the Overview tab shows 49 / 151 / 42. The cards read `crawl_jobs.summary`, which is null or lacks totals for those jobs. Fix: the header reads the same source as Overview — a single server-side `getIssueTotals(jobId)` (groupBy severity on `crawl_issues`) used by both; `summary` becomes a cache that is only trusted when it carries `totals` with the current shape, otherwise the groupBy runs. Add a test: a job with `summary = null` and three issues of different severities renders 1 / 1 / 1 in the header.

Also: "1 crawls this month" → pluralise ("1 crawl", "2 crawls") in all three catalogs.

### 6. Tests

- Route table + nav registry updated; old path returns a 308 to `/crawler` in a route test.
- Sidebar renders "Nosy Bat" for a paid tenant and hides it for an unpaid one.
- Header title test for `/crawler`.
- The brand-string test from SITE-CRAWLER-BRANDING.md still passes (the sidebar label must come from `CRAWLER_BRAND.name`, not a literal).

## Definition of done

- `tsc` clean, suite green, tree clean, one commit: `app: Nosy Bat™ gets its own route, sidebar entry and header; header issue totals read from crawl_issues`.
- Report: file map, icon-slot decision, the redirect behaviour verified with curl on a throwaway port, before/after test counts, deviations with reasons, the deploy line (build + `pm2 restart echorank360-web` — the workers don't change — + CF Purge Everything).
- No deploy without being told.

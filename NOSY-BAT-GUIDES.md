# Nosy Bat guides — content + build spec

Repo: /opt/echorank/app. One session. Four illustrated guides under `/learn/guides/`, original text (EN below, FR by the builder), each with three inline-SVG diagrams drawn from the specs here (no screenshots, no third-party imagery). Where each guide references a UI element, use the name the UI actually shows (check the components; don't guess).

## Build instructions

1. Phase 0: locate `learn-content.ts` (guides, Article JSON-LD), the `/learn/guides/[slug]` route, the howto-art pictogram components, `marketing-copy.ts`, the Help modal footer, the `/site-crawler` page, PublicNav Resources › Learn.
2. Add four guide entries with the slugs below. Body in EN first pass; FR title, description and body (same meaning, French-Canadian register, "Nosy Bat" untranslated). de-CH chrome only.
3. Diagrams: React SVG components under `src/components/learn/nosy-bat-art/`, 640×360 viewBox, responsive, `currentColor` text, the emerald accent for highlights, gray-200 strokes, no raster. Each diagram has a `<title>` and `aria-describedby` with the caption. Specs under each guide.
4. JSON-LD: Article plus HowTo (steps from the numbered sections) on guides 1, 2 and 4; Article only on guide 3.
5. Links: Resources › Learn gains a "Nosy Bat guides" group with the four; `/site-crawler` gets a "Guides" strip (four cards) above the FAQ; the Help modal footer lists them. Cross-link the four to each other where noted.
6. Calls to action — three per guide, same component (`<GuideCta>`), auth-aware like the top nav:
   - **Inline CTA** after the first numbered step: a slim emerald-50 band with the mark, one line of copy (per guide below), and a button. Signed out: button "See plans" → `/pricing`; when `crawl.free` is on, a second text link "or crawl 100 pages free" → `/free-tools/site-crawler`. Signed in: button "Open Nosy Bat" → `/crawler`.
   - **Mid-guide nudge** after the export / compare step: one sentence with a text link (per guide below).
   - **Closing CTA block** before "Related": card with the lockup, headline + two lines (per guide below), the same auth-aware button, and the free-crawl link when the flag is on. Every CTA button on these pages goes to `/pricing` or `/crawler`, never to the registration form (site rule).
   - CTA copy is original and lives in `marketing-copy.ts` under `guideCtas[slug]`, en/fr.
7. Sitemap priority 0.6 each; `LOCALIZED_ROUTES` if the guide route isn't already dynamic there.
8. Tests: four slugs render en/fr, JSON-LD validates, every diagram has a title, nav test updated, axe on one guide.
9. One commit per guide, one for nav/links. Web only + CF purge. Do not deploy.

---

## Guide 1 — `how-to-find-broken-links`

**Title:** How to find broken links on your site (and fix them in the right order)
**Description:** Find every 404 and server error with Nosy Bat, see which page each one was found on, and export the list for whoever fixes it.

### Why broken links matter

A broken link wastes a click. For a visitor it's a dead end; for a search engine it's a signal that the site isn't maintained, and the link equity flowing into that URL goes nowhere. Internal broken links are entirely yours to fix. External ones — links you make to other sites — can't be fixed at the source, but they can be updated or removed.

Nosy Bat finds both kinds in one crawl and, unlike a single-page checker, tells you **where** each broken link lives, so you don't have to search for it.

### 1. Start a crawl

Go to **Nosy Bat → New crawl**, paste your homepage URL, keep **Spider** mode, leave rendering off unless your site builds its links with JavaScript, and start. A few hundred pages take a couple of minutes; Nosy Bat obeys robots.txt and never sends more than two requests a second.

### 2. Open the Issues view

When the crawl completes, open **Issues**. Broken links sit in the **Response codes** family:

- **Internal 4xx** — pages on your site that return 404, 410 or similar
- **Internal 5xx** — pages your server failed to deliver
- **External 4xx / 5xx** — links from your site to other sites that no longer work
- **No response** — timeouts

Each row shows how many pages are affected. Expand it to see the URLs and, beside each, **Found on** — the page that links to it — with the anchor text.

### 3. Export the list

Use **Exports → Broken links (CSV)**. Every row is one link: the source page, the broken URL, the anchor text and the status code. This is the file you hand to a developer or a content editor; it needs no further explanation.

### 4. Fix in the right order

Not every broken link needs the same fix:

- **The page moved** → add a 301 redirect from the old URL to the new one, then update the link anyway so visitors don't pay for the hop
- **The page is gone for good** → remove or replace the link; let the URL return 410 if nothing should replace it
- **A typo in the link** → correct the link; no redirect needed
- **An external site changed** → update the link to the new location or remove it

Start with internal 4xx on pages that have the most inlinks (the Pages view sorts by inlinks and by Link Score) — those are the links most visitors and crawlers hit.

### 5. Confirm, then keep watching

Run the crawl again and open **Compare** against the first one: the Response codes rows should show as *resolved*. Then create a weekly **schedule** so new broken links reach your inbox before your visitors find them.

**Related:** [How to audit a site migration](#guide-4) · [Learn SEO →](/learn)

### Calls to action

- **Inline (after step 1):** "Nosy Bat finds every broken link on your site and tells you which page it's on."
- **Nudge (after step 3):** "Want this list every week without lifting a finger? Schedules do that on every paid plan."
- **Closing:** headline "Stop finding broken links by accident." · "Crawl up to 25,000 pages, export the source of every broken link, and get a weekly check in your inbox." · "Included in every Echorank plan — no per-user licence."

### Diagrams

- **1a "Where a broken link lives":** three page cards in a row (Home → Services → Pricing) with arrows; the Services → Pricing arrow ends at a red "404" badge; a callout "Found on: /services — anchor 'see pricing'".
- **1b "The export, one row per link":** a four-column table outline (Source page · Broken URL · Anchor · Status) with two example rows, the status cells coloured (404 red, 503 red, 301 amber).
- **1c "Which fix":** a small decision tree — "Page moved?" → yes: "301 + update link" / no: "Gone for good?" → yes: "Remove link, 410" / no: "Fix the typo".

---

## Guide 2 — `xml-sitemap-generator`

**Title:** Generate an XML sitemap from a crawl
**Description:** Build a sitemap that only lists pages search engines should index — from what Nosy Bat actually crawled, not from a guess.

### What a sitemap should and shouldn't contain

A sitemap is a list of URLs you want indexed, with optional hints about when each changed. Search engines treat it as a suggestion, not a command, so a sitemap full of redirects, noindexed pages and duplicates does more harm than good: it wastes crawl budget and tells the engine your signals can't be trusted.

Nosy Bat builds the sitemap from the crawl, so it only contains pages that are **indexable** today: HTML, status 200, no `noindex`, not canonicalised to another URL, not blocked by robots.txt.

### 1. Crawl the site

Any completed spider crawl works. If part of the site shouldn't be listed (a staging folder, internal tools), exclude it with **Advanced options → Never crawl URLs matching** before you start, or add an exclusion in the sitemap options below.

### 2. Open the generator

On the crawl's results page choose **Exports → Generate XML sitemap**. The options:

- **Include** — indexable pages only (default). Leave it.
- **lastmod** — the page's `Last-Modified` header when the server sends one, the crawl date, or none. Use the header if your CMS sets it correctly; otherwise none. A wrong lastmod is worse than no lastmod.
- **changefreq and priority** — fixed values, or derived from crawl depth (homepage highest). Most engines ignore these; keep the defaults.
- **Exclude patterns** — paths to leave out even if indexable.
- **Image sitemap** — a second file listing the images found on each page.

### 3. Download and place the files

You get a zip: `sitemap.xml`, or `sitemap-1.xml`, `sitemap-2.xml`… with a `sitemap-index.xml` when there are more than 50,000 URLs. Upload them to the root of the site, next to `robots.txt`, so the sitemap URL is `https://your-site.com/sitemap.xml`.

### 4. Tell the engines

Add one line to `robots.txt`:

```
Sitemap: https://your-site.com/sitemap.xml
```

Then submit the same URL in Google Search Console under **Sitemaps**. Nosy Bat's **Sitemaps** family will confirm on the next crawl that the sitemap is reachable, declared in robots.txt and contains no non-indexable URLs.

### 5. Keep it current

Regenerate after any structural change — new sections, removed pages, a migration. If you crawl on a **schedule**, the sitemap options you chose are remembered, so a fresh file is one click after each run.

**Related:** [How to find broken links](#guide-1) · [How to audit a site migration](#guide-4)

### Calls to action

- **Inline (after step 1):** "Your sitemap should list what's indexable today — Nosy Bat builds it from a real crawl."
- **Nudge (after step 3):** "Sites change; sitemaps go stale. A scheduled crawl keeps the file one click from current."
- **Closing:** headline "A sitemap search engines can trust." · "Indexable pages only, split automatically at 50,000 URLs, image sitemap included." · "Generate it from any crawl on any paid plan."

### Diagrams

- **2a "From crawl to sitemap":** a funnel in three bands — "Crawled: 1,240 pages" → "Indexable: 980" (listing what drops out: redirects, noindex, canonicalised, non-HTML) → "In the sitemap: 980".
- **2b "Large sites":** a tree — `sitemap-index.xml` at the top, three children `sitemap-1.xml` (50,000), `sitemap-2.xml` (50,000), `sitemap-3.xml` (12,400).
- **2c "Where it goes":** a browser-address-bar outline `your-site.com/sitemap.xml`, a `robots.txt` file card with the `Sitemap:` line highlighted, and a Search Console card with "Submitted".

---

## Guide 3 — `web-scraping-with-custom-extraction`

**Title:** Web scraping with custom extraction
**Description:** Pull prices, SKUs, authors, dates or any value from every page of a site in one crawl — with CSS selectors, XPath or a regular expression.

### What extraction is for

A crawl already collects the SEO facts about each page. Extraction collects **your** facts: the price on every product page, the author and date on every article, the schema type, the tracking tag, the text of a specific heading. The result is a table with one row per page and one column per extractor, exportable as CSV.

Typical uses: check that every product shows a price; list every post without an author; find pages whose breadcrumb is missing; confirm the analytics tag is on every page; collect all `og:image` values to find pages sharing one.

### The three ways to point at a value

- **CSS selector** — the simplest. `h1`, `.price`, `meta[property="og:title"]`. Pick an attribute (`content`, `href`) or the text.
- **XPath** — when you need structure: `//div[@class="price"]/span[2]`, or "the paragraph after this heading".
- **Regular expression** — against the page source, for things that aren't elements: an order ID pattern, a tracking ID, a date in a script.

Presets prefill the common ones: Open Graph tags, price and SKU, author and date, hreflang, canonical.

### 1. Add extractors before the crawl

**New crawl → Advanced options → Extraction & search**. Name each extractor, choose the type, paste the expression, and tick **multiple** if a page can hold several values (every product on a category page). Up to 3, 5 or 10 extractors depending on your plan.

### 2. Add a custom search (optional)

The same panel takes up to five **searches**: a string or pattern checked against every page's source. The count per page appears as a column on Pages, so "which pages don't contain `gtag(`" is a one-click filter.

### 3. Read the Extraction tab

After the crawl, **Data → Extraction** shows URL plus one column per extractor. Filter **has value / empty** to find the pages that are missing something. Export respects the filter.

### 4. Turn values into segments

Extracted values can define a **segment** — "pages where `type` = product" — and every other view (Issues, Pages, Compare) can then be filtered to that segment. This is how you check "do all product pages have structured data" without touching a spreadsheet.

### 5. Pages built by JavaScript

If the value only exists after JavaScript runs, turn on **rendering** (thin pages or all) and the extractors run on the rendered page. On a **verified site** you can also run a **custom JavaScript** snippet — scroll, click "load more", read a data layer — and keep what it returns.

### Limits and manners

Nosy Bat identifies itself, obeys robots.txt and stays under two requests a second, on your site and on any other. Extraction is for sites you own or have permission to crawl; it is not a way around a site's terms. JavaScript snippets and non-standard user agents are only available on sites you have verified as yours.

**Related:** [How to find broken links](#guide-1) · [Learn SEO →](/learn)

### Calls to action

- **Inline (after step 1):** "Three extractors on Starter, ten on Agency — CSS, XPath or regex, on every page of the crawl."
- **Nudge (after step 3):** "Turn an extracted value into a segment and every report filters to it — no spreadsheet needed."
- **Closing:** headline "Every page, your columns." · "Extract prices, authors, tags or anything else across the whole site in one crawl, then export it." · "Rendering and custom JavaScript when the page is built in the browser."

### Diagrams

- **3a "Selector to value":** left, a small HTML snippet card (`<div class="price"><span>$49</span></div>`); middle, three labelled chips (CSS `.price span` / XPath `//div[@class="price"]/span` / Regex `\$\d+`); right, a result cell "$49".
- **3b "The extraction table":** a table outline — URL · Price · SKU · Author — with four rows, one cell empty and highlighted with "empty" filter chip above.
- **3c "Values become segments":** a funnel/flow — "Extractor: type" → chips "product · article · page" → "Segment: product (312 pages)" → an Issues bar "Issues in this segment".

---

## Guide 4 — `how-to-audit-a-site-migration`

**Title:** How to audit a site migration (before and after it goes live)
**Description:** Use list mode, redirect chains and crawl comparison with URL mapping to make sure a redesign or domain move loses nothing.

### The two moments that matter

A migration goes wrong in one of two ways: old URLs stop resolving, or the new site lost pages, titles or links the old one had. The first shows up as 404s and redirect chains; the second only shows up if you compare. Nosy Bat covers both — the audit is two crawls and a list.

### Before launch

**1. Baseline the old site.** Run a full spider crawl of the live site and **pin** it in History so retention never removes it. This is the reference everything is compared to.

**2. Export the URL list.** From that crawl, **Exports → Pages (CSV)**. The URL column is your list of everything that must still resolve after launch.

**3. Crawl staging.** If the new site is on a staging host, crawl it too (HTTP auth and custom headers are in Advanced options). Then open **Compare**, pick the baseline, and add a **URL mapping** so staging URLs match production ones — for example find `^https://staging\.` replace `https://www.`. Compare shows pages missing on the new site, titles and canonicals that changed, and issues introduced.

### Launch day

**4. Check every old URL.** Switch **New crawl** to **List** mode and paste the URL list from step 2. Nosy Bat fetches each one and records every hop. In **Links → Redirects**, look for:

- **4xx** — old URLs with no redirect: the most urgent fix
- **Redirect chains** — old → interim → final; collapse them to a single 301
- **Redirect loops**
- **302s** that should be 301s

**5. Crawl the new site in full** and **Compare** against the pinned baseline (no mapping needed now). Confirm pages are not missing, health hasn't dropped, and the Sitemaps family shows the new sitemap declared and clean ([generate one](#guide-2) from this crawl if needed).

### After launch

**6. Schedule the crawl weekly** for the first month, with email export, so late-appearing problems (cached old links, a CMS re-publishing old slugs) are caught. Keep the baseline pinned until the comparison has been clean twice.

**Related:** [How to find broken links](#guide-1) · [Generate an XML sitemap](#guide-2)

### Calls to action

- **Inline (after step 1):** "Pin the baseline crawl now; after launch, Compare shows exactly what changed."
- **Nudge (after step 5):** "Staging on another host? URL mapping compares it to production before anyone else sees it."
- **Closing:** headline "Launch without losing a page." · "List-mode redirect checks, crawl comparison with URL mapping, and a weekly watch for the first month." · "Everything in this guide is on every paid plan."

### Diagrams

- **4a "The timeline":** a horizontal timeline with three markers — Before (baseline crawl, URL list, staging compare) · Launch (list-mode check, full crawl + compare) · After (weekly schedule) — each with two or three bullet words under it.
- **4b "Collapse the chain":** top row: `/old` → 301 → `/interim` → 301 → `/new` (three hops, amber); bottom row: `/old` → 301 → `/new` (one hop, emerald), labelled "before / after".
- **4c "URL mapping":** two columns of URLs, staging on the left (`staging.site.com/about`), production on the right (`www.site.com/about`), joined by lines; a chip above with `^https://staging\. → https://www.`.

---

## "Learn SEO"

No new guide. The entry in the sidebar list links to the existing `/learn` course; add a card in the course index pointing to the four guides above under "Technical SEO with a crawler".

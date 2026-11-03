# Echorank Homepage — "Two Crawlers" Section

Repo: /opt/echorank/app. Conventions in CLAUDE.md / AGENTS.md apply. Run as `deploy`. One session, one commit. No deploy without being told.

Prerequisite: SITE-CRAWLER-BRANDING.md committed (`public/nosy-bat/*.svg`, `src/lib/site-crawler/brand.ts`). If `CRAWLER_BRAND` does not exist, STOP and report.

## The pitch

Echorank runs two crawlers over a site. One sees it the way AI engines do and then checks what those engines say about the brand; the other sees it the way search engines do, every page, against the full rule library. The homepage currently shows neither as a crawler. Add one section that presents both, side by side, with Nosy Bat™ carrying its mark and the AI Visibility auditor carrying the Echorank name (no mascot — it is the platform, not a tool).

## Phase 0 — investigate (no edits)

Locate: the homepage (`src/app/[locale]/page.tsx` and its sections — the `/0N` numbered pattern, `home2.module.css`, the `s.btn` / `s.btn secondary` classes), the homepage copy catalog (en / fr; de-CH folds to en on the homepage), `PricingSection`, the `/free-audit` route, the CTA rule (every marketing CTA → `/pricing`; the free-audit widget is the one standing exception), the SoftwareApplication JSON-LD source, the feature-flag mechanism if one exists (else `src/lib/flags.ts` is the place to add one), and whether `packages/crawl-rules` exports `RULES` (Phase 3a). Print the file map and the current section order.

## Build

### 1. Section placement

Insert a new numbered section **directly after the hero** and before whatever section currently follows it; renumber the `/0N` eyebrows so the sequence stays contiguous. Two-column card layout on desktop (equal columns), stacked on mobile; Binance tokens (`#181A20` / `#1E2329` / `#2B3139`, accent `#FCD535` / `#F0B90B`); the two cards get the same height and the same CTA row structure so they read as a pair.

### 2. Rule count — derived, never typed

`const RULE_COUNT = RULES.length` imported from `packages/crawl-rules` when it exists, else the count of the live Phase 2 issue types from `src/lib/site-crawler/checks.ts` (`ISSUE_TYPES.length`). The copy renders the number from that constant. Add a test that the homepage never contains a hardcoded digit string for the rule count (grep the rendered copy for `/\b\d{2,3}\+? (checks|rules|vérifications|règles)\b/` and assert it matches `RULE_COUNT` only). When the count is below 100, the copy says "`{n}` checks"; at 100 or more it says "`{n}`+ checks" (round down to the nearest 10: 130 → "130+", 283 → "280+").

### 3. Copy (EN source of truth; FR below). Keys go in the homepage copy catalog, not inline.

**Eyebrow:** Two crawlers
**H2:** Two crawlers. One honest picture of your site.
**Lead:** Search engines read your site one way. AI engines read it another way, then talk about it. Echorank runs both views, in your browser, nothing to install.

**Card A — AI Visibility auditor** (eyebrow: "Echorank AI Visibility")
Title: What AI engines see, and what they say.
Body: Checks whether ChatGPT, Gemini, Claude and Perplexity can reach and render your pages, measures the gap between what they read and what your visitors see, validates your llms.txt, then asks the engines about your brand and tracks the answers week over week.
Bullets:
- AI-crawler access: robots.txt, Cloudflare, rendering
- Raw-vs-rendered gap on every audited page
- llms.txt validation
- Brand answers tracked across engines
Primary CTA: "Run the free AI visibility check" → `/free-audit`
Secondary (text link): "See plans" → `/pricing`

**Card B — Nosy Bat™** (header = the lockup `CRAWLER_BRAND.logoOnDark` as an `<img>`, alt "Nosy Bat, crawler by Echorank", height 56 px; no text title above it)
Title: What search engines see, every page.
Body: Crawls up to 25,000 URLs and checks each one against `{RULE_COUNT}` rules: broken links, redirect chains, titles and descriptions, duplicate and thin content, directives, hreflang, structured data and security headers. Every finding is an issue, a warning or an opportunity, with the evidence next to it.
Bullets:
- `{RULE_COUNT}`+ checks across ten rule families
- Issues, warnings and opportunities, with evidence
- CSV export of every table
- Included in every paid plan — no per-seat licence
Primary CTA: "See plans" → `/pricing`
Secondary (text link): "Meet Nosy Bat" → `/site-crawler`, rendered only when the flag `crawl.publicPage` is on (that page is Phase 4f); hidden otherwise, with no placeholder.

**Closer (one line under both cards):** Your whole team on one plan. Both crawlers run on our servers, on a schedule if you want, and share nothing with anyone but you.

Bullets that describe a capability not yet shipped are gated the same way: the "ten rule families" bullet reads "across every rule family" until `RULES` exists; the hreflang / structured-data / security words in the body are dropped until their families are in the registry (check family ids at build time, do not hand-maintain).

**FR**
Eyebrow: Deux robots d'exploration
H2: Deux robots. Une image honnête de votre site.
Lead: Les moteurs de recherche lisent votre site d'une façon. Les moteurs d'IA le lisent autrement, puis en parlent. Echorank fait les deux lectures, dans votre navigateur, sans rien installer.
Card A eyebrow: Echorank Visibilité IA · Title: Ce que les moteurs d'IA voient, et ce qu'ils disent. · Body: Vérifie si ChatGPT, Gemini, Claude et Perplexity peuvent atteindre et rendre vos pages, mesure l'écart entre ce qu'ils lisent et ce que voient vos visiteurs, valide votre llms.txt, puis interroge les moteurs sur votre marque et suit les réponses semaine après semaine. · Bullets: Accès des robots d'IA : robots.txt, Cloudflare, rendu / Écart brut-rendu sur chaque page auditée / Validation du llms.txt / Réponses sur votre marque suivies d'un moteur à l'autre · CTA: Lancer la vérification gratuite de visibilité IA / Voir les forfaits
Card B: Title: Ce que les moteurs de recherche voient, page par page. · Body: Explore jusqu'à 25 000 URL et vérifie chacune selon `{RULE_COUNT}` règles : liens brisés, chaînes de redirection, titres et descriptions, contenu dupliqué ou trop mince, directives, hreflang, données structurées et en-têtes de sécurité. Chaque constat est un problème, un avertissement ou une occasion, avec la preuve à côté. · Bullets: `{RULE_COUNT}`+ vérifications dans dix familles de règles / Problèmes, avertissements et occasions, avec preuves / Export CSV de chaque tableau / Inclus dans chaque forfait payant, sans licence par utilisateur · CTA: Voir les forfaits / Rencontrer Nosy Bat
Closer: Toute votre équipe sur un seul forfait. Les deux robots tournent sur nos serveurs, à l'horaire si vous le souhaitez, et ne partagent rien avec personne d'autre que vous.

"Nosy Bat" is never translated. The ™ renders as `™` in the lockup only; body text says "Nosy Bat" without it.

### 4. JSON-LD

The homepage SoftwareApplication JSON-LD gets a `featureList` with two entries: "AI visibility audit" and "Site crawler (Nosy Bat)". Prices stay derived from `PLAN_CONFIGS` as today.

### 5. Links elsewhere

Nothing else changes. No nav entry, no new route. The SEO Tools hub card already carries the brand from SITE-CRAWLER-BRANDING.md.

### 6. Verification

- Unit: copy keys present in en and fr; rule-count test (above); flag off → no "Meet Nosy Bat" link in the rendered HTML; flag on → link present.
- Visual: build, start on a throwaway port (`:4401`, as earlier sessions did), Playwright screenshots of `/en` and `/fr` at 390 px and 1280 px, save to the scratchpad and report the paths. The two cards must be equal height on desktop and the lockup must not overflow on mobile.
- `tsc` clean, suite green, tree clean.

## Definition of done

- One commit: `home: two-crawlers section (AI Visibility auditor + Nosy Bat™)`.
- Report: section position, `RULE_COUNT` value at build time and where it came from, which gated words were dropped, screenshot paths, deviations with reasons, the deploy line (build + `pm2 restart echorank360-web` + Cloudflare Purge Everything — mandatory, the homepage is edge-cached).
- No deploy without being told.

# EchoRank Browser Extension

Imports reviews from **Google**, **Facebook**, and **Trustpilot** pages directly
into EchoRank, where they flow through the same analysis pipeline as every other
review source (sentiment, theme detection, reputation risk, escalation).

> **⚠️ Read this first.** Scraping Google / Facebook / Trustpilot is against each
> platform's Terms of Service, and a logged-in user scraping their own account
> can be rate-limited or actioned. CSS selectors also break whenever those sites
> reskin their DOM. The durable, ToS-clean path is the official APIs (Google
> Business Profile API, Trustpilot Business API, Meta Graph) via OAuth — see
> _Remaining work_. This extension is the fast-to-ship option, not the
> maintenance-free one.

---

## Architecture

```
Browser (Chrome/Edge/Brave)
  ├─ content/google|facebook|trustpilot.ts   scrape DOM → ScrapedReview[]
  ├─ background/service-worker.ts            holds token, POSTs to API (no CORS)
  └─ popup/                                  status + Scan&Import + Settings
                     │  Authorization: Bearer er_ext_…
                     ▼
EchoRank (Next.js)
  POST /api/extension/import   bearer auth → zod validate → rate-limit
        │                      → upsert MonitoringSource → stage ImportJob
        ▼                      → enqueue "extension-import"
  extension-import.worker      → buildExtensionReviews() (server-side shaping)
        │                      → persistAndDispatchReviews()
        ▼
  Existing pipeline:  dedup → ExternalReview insert → ai-processing/analyze-review
                      → review.published event → reputation + escalation
```

### Key design decisions (deviations from the original spec)

1. **Reuses `ExternalReview` + `MonitoringSource`, not a new `ImportedReview`
   table.** Imported reviews are first-class reviews. Reusing the existing model
   means sentiment, theme detection, risk scoring, reputation recalculation, and
   the Monitoring dashboard all work with zero parallel code. The spec's standalone
   `ImportedReview` table would have created a second, unanalyzed silo.
2. **One `extension-import` queue, not three** (`review-import/analysis/dedup`).
   Dedup and AI analysis already exist as `persistAndDispatchReviews()` +
   `ai-processing`. The extension worker is a thin staging→shape→handoff step.
3. **Opaque hashed bearer tokens, not raw JWTs.** A stateless JWT cannot be
   revoked without a denylist. We store only `sha256(secret)`; revocation is a
   single column flip (`revokedAt`). Same `Authorization: Bearer` ergonomics.
4. **Vanilla-TS popup, not React.** A popup this small does not justify bundling
   a React runtime; keeps the esbuild step trivial.

### Server files

| File | Purpose |
| --- | --- |
| `src/lib/extension-token.ts` | issue / verify / rotate / revoke tokens |
| `src/monitoring/import/extension-schema.ts` | zod validation of the scraped batch |
| `src/monitoring/ingestion/extension-ingest.ts` | scraped → `ExternalReviewInput[]` |
| `src/app/api/extension/import/route.ts` | bearer-auth ingest endpoint |
| `src/app/api/extension/token/route.ts` | dashboard token management |
| `src/infrastructure/queue/workers/extension-import.worker.ts` | staged batch → pipeline |
| `src/app/(dashboard)/extension/page.tsx` | token UI |

---

## Installation (end user)

1. In EchoRank, open **Extension** in the sidebar and **Create token**. Copy it
   (shown once).
2. Build/obtain the extension (see below), then in `chrome://extensions` enable
   **Developer mode** → **Load unpacked** → select the `extension/dist` folder.
   (Edge: `edge://extensions`; Brave: `brave://extensions`.)
3. Click the extension icon → **Settings** → paste the token → **Save**.
4. Open a Google/Facebook/Trustpilot review page → **Scan & Import Reviews**.
5. Imported reviews appear under **Monitoring** and **Data Sources**.

---

## Development

```bash
cd extension
npm install
npm run watch       # rebuild dist/ on change
npm run typecheck   # tsc --noEmit (strict)
```

Load `extension/dist` unpacked; reload from `chrome://extensions` after a build.
Point the extension at a local server via **Settings → API Base URL**
(`http://localhost:3000`). Add `http://localhost:3000/*` to `host_permissions`
in `manifest.json` for local testing.

Server side:

```bash
npx prisma migrate dev --name extension_tokens   # or apply the bundled migration
npx prisma generate
npm run test:extension                            # normalization unit tests (7)
```

---

## Build process

`extension/build.mjs` uses esbuild to bundle each entry point
(`background/service-worker`, the three `content/*`, `popup/popup`) to ESM and
copies `manifest.json`, `popup/index.html`, and `assets/` into `dist/`.

```bash
npm run build   # → extension/dist
npm run zip     # → extension/echorank-extension.zip (for store upload / sharing)
```

`dist/` is what you load unpacked and what you upload to the Chrome Web Store /
Edge Add-ons. Replace `assets/icon-*.png` (currently solid-color placeholders)
before publishing.

---

## Security model

- **Untrusted client.** The extension only *proposes* reviews. All shaping
  (external ids, dedup keys, rating clamping, date parsing) happens server-side
  in `buildExtensionReviews()`. The endpoint never persists raw client input.
- **Auth.** Opaque bearer token; only `sha256(secret)` is stored; constant-time
  compare; instant revocation via `revokedAt`; optional `expiresAt`.
- **Tenant isolation.** The token resolves to a `(tenantId, userId)`; every row
  is written under that `tenantId`. Token management is session-auth + tenant
  scoped, so one tenant cannot revoke another's token.
- **Rate limiting.** Per-token fixed window (30 imports / 60s) in Redis; fails
  open with a warning if Redis is unavailable.
- **Body limits.** 1 MB request cap; max 200 reviews/batch; per-field length caps
  in the zod schema; `.strict()` rejects unknown keys.
- **Token never enters page context.** Only the service worker holds it and makes
  the POST under `host_permissions` (so it is not exposed to content scripts or
  the page, and is not subject to page CORS).
- **CSRF.** Not applicable to the bearer endpoint (no cookies/credentials used);
  the cookie-authed token-management routes are same-origin Next.js handlers.

---

## Troubleshooting

**"No reviews found on this page."** The selectors no longer match the live DOM
(the most common failure). Open DevTools on the review page, inspect a review
card, and update the layered selector arrays at the top of the relevant
`content/*.ts` (`REVIEW_CARD_SELECTORS`, etc.). The scraping *structure* (wait →
expand → scroll → extract) is stable; only the selector strings rot. Prefer
attribute selectors (`[data-review-id]`, `[data-service-review-*]`) over hashed
class names.

**"Could not read reviews from the page."** The content script isn't injected —
confirm the URL matches a `content_scripts.matches` pattern in `manifest.json`,
and reload the tab after loading the extension.

**401 Invalid or revoked token.** Re-issue in the dashboard and re-save in the
popup. Check **API Base URL** points at the right environment.

**429.** You hit the per-token rate limit (30/60s); wait and retry.

**Migration enum error on older Postgres.** If `ALTER TYPE … ADD VALUE` fails in
a transaction (PG < 12), split the migration so the enum addition runs alone.

---

## Remaining work (technical debt)

- **Live-DOM selector validation** for all three scrapers — the selectors are
  best-effort and unverified against current production DOM. This is the #1 item
  before any real use.
- **Browser test matrix** (Chrome/Edge/Brave) — not yet automated; needs Playwright
  with the extension loaded, or manual QA.
- **Trustpilot multi-page crawl** — current scraper handles the visible page only.
- **Official-API migration path** — the strategically correct replacement for
  scraping (Google Business Profile API, Trustpilot Business API, Meta Graph).
- **Plan gating** on `/api/extension/import` (CSV import gates on `ai_analysis`;
  the extension path currently does not).
- **Per-token scopes** — the `scopes` column exists but is not yet enforced.
- **Icons** — replace placeholder PNGs with real brand assets.

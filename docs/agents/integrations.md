# Integrations

Last verified: 2026-07-29 by Claude Opus 5 (1M context).

## DataForSEO

Client: `src/lib/dataforseo/client.ts`. Reuse it — do not hand-roll a fetch.

**Build against fixtures.**

```
DATAFORSEO_FIXTURES=1   # serve recorded envelopes, zero live spend
DATAFORSEO_RECORD=1     # persist live envelopes to fixtures/ as they arrive
```

Replay wins: recording while replaying is a no-op (`src/lib/dataforseo/fixtures.ts`).
Fixtures live in `fixtures/dataforseo/`. Develop on fixtures, record once against live,
then pin the parse with a test over the recorded envelope — field-layout mistakes here fail
*silently*, yielding zeros or empty lists rather than exceptions.

**Cost.** Log `costUsd` on every stored run (`Decimal(10,6)` on the audit/check tables) and
meter through `src/lib/dataforseo/metering.ts`.

SERP standard queue bills **per result page, not per task**: $0.0006 buys depth 10, so
**depth 100 is $0.006 per keyword** — 10×, verified live July 2026
(`src/lib/serp/service.ts:38`). Budgeting at $0.0006 understates spend by an order of
magnitude.

Labs and Backlinks endpoints are **live-only** — no standard queue, no fixtures shortcut for
the queue path.

The standard queue's `tasks_ready` is a shared drain needing exactly one reader
(`src/lib/dataforseo/standard-queue.ts`). OnPage/Site Audit is a different protocol and has
its own poller on purpose — do not merge them.

## Google

Three independent connections, three separate OAuth grants. They do not share tokens.

| | Model | Scope |
|---|---|---|
| Search Console | `GscConnection` | read-only |
| Analytics (GA4) | `GaConnection` | read-only |
| Business Profile | — | see below |

Refresh tokens are stored AES-256-GCM encrypted (`src/lib/gsc/crypto.ts`, key from
`GSC_TOKEN_ENCRYPTION_KEY`) as `v1:<iv>:<tag>:<ciphertext>`. Never plaintext, never logged.
Expiry/revocation surfaces as `NEEDS_REAUTH` plus a reconnect banner, not an error page.

**GSC data timing** — the thing that looks like a bug and is not:

- Search Console data lags **~2 days**. The 28-day window ends where Google's data ends.
- Google withholds any query searched by too few people to stay anonymous. A low-traffic
  property can show real clicks and impressions in the totals and **zero query rows**.

`syncDay()` writes `GscConnection.lastRowsSynced` on every run, zero included, so "the sync
ran" and "the sync stored rows" are distinguishable. Check it before declaring the sync
broken. See [gotchas.md](gotchas.md).

GBP monitoring is a scaffold (`/visibility/tools/gbp-monitor`), not a live connection.

## PageSpeed Insights

Lighthouse tool (`/visibility/tools/lighthouse`) calls the PSI API. Lab data is available
for any page; field data (CrUX) only exists for pages with enough real traffic, so its
absence is normal and the copy says so. Scores move several points between runs — the UI is
written for trends, not single numbers.

## Stripe

Checkout and the billing portal both ship. This section said the opposite until
2026-08-15; it was written in late July and never updated when they landed, which is the
failure mode CLAUDE.md's "the code wins — fix this file in the same commit" rule exists to
stop. What is actually there:

- `src/lib/stripe/` — `client.ts` (`getStripe()`, reads `STRIPE_SECRET_KEY` at call time so
  the live/sandbox split is a deploy decision), `lookup-keys.ts`, `prices.ts`.
- `POST /api/billing/checkout` — subscriptions only (`mode: "subscription"`, hardcoded),
  eight tier/interval lookup keys, a §8.1 consent gate ahead of the auth branch, and a
  `client_reference_id = tenantId` stamp that is how the webhook finds a tenant with no
  Stripe customer yet.
- `POST /api/billing/portal` — the billing portal.
- `/api/webhooks` — signature verification, and `ProcessedWebhook.stripeEventId` (`@unique`)
  as an idempotency marker that is deleted again if a handler throws, so Stripe's retry
  re-runs a failed event rather than skipping it.

**Prices are never created or edited by the app.** They are resolved live by lookup key, and
a missing key is a 404 rather than a fallback to some other price. The lookup keys are
`echorank_<tier>_usd_<interval>` for plans and the standalone Watcher.

`scripts/seed-plan-prices-usd.ts` exists, is idempotent, and aborts on an empty key by
design — it has never run.

**Before touching Stripe at all, read the shared-account rules in
[gotchas.md](gotchas.md#stripe-the-live-account-is-shared-with-7-other-products).** The live
account carries seven or more products, an unscoped sweep has already archived another
product's prices once, and every query must be scoped by `metadata[app]=echorank`.

## AI providers

`AI_PROVIDER="mock"` in `.env`. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are empty on the
web app, so every `ai_analysis` surface falls back to heuristics — by design, and the copy
tells the user when it happened rather than failing. The av-service sidecar carries its own
key.

**The answer check asks Claude only.** The sidecar's `/track` (`answer_track.py`, model from
`TRACK_MODEL`, default `claude-haiku-4-5`) is what tracked prompts and the partner API's
`/visibility/query` run, and it answers with one engine: Claude. Marketing copy that says
Echorank monitors six engines (the homepage hero and feature cards, the "six engines"
paragraph in `src/lib/i18n/content.ts`) describes more than this path does; the
multi-provider list in `src/lib/ai-monitor/pricing.ts` belongs to the AI Search monitor,
and each provider there is live only when its key is set.

## Email / SMS

`SMTP_*` empty, `BREVO_API_KEY` absent though `/api/webhooks/brevo` exists, Twilio
partially configured. Campaigns, review requests, digests and alerts are inert. Treat any
"send" path as unexercised in production.

## Partner API (EchoPilot)

Echorank's AI-visibility engine for sibling products. EchoPilot never calls the av-visibility
sidecar or holds `INTERNAL_API_SECRET`; it calls this, and Echorank owns the engine, the
limits and the cost. Code: `src/lib/partner/` (auth, limits, quota, shape, service),
routes under `src/app/api/partner/v1/`. Tests: `tests/partner-api.test.ts`.

**Base URL.** `http://127.0.0.1:4400/api/partner` from this box (EchoPilot's
`ECHORANK_API_BASE`): loopback skips Cloudflare and TLS, and the proxy treats
`/api/partner/v1/` like `/api/public/v1/` (no session, no CSRF origin check). From
elsewhere: `https://echorank360.com/api/partner`.

**Auth.** `Authorization: Bearer er_api_<id>.<secret>`, a key with scope `partner`
(`api_keys.scopes`). Keys live on the internal tenant "EchoPilot (partner)" (slug
`echopilot-partner`) and are issued with `npm run partner:create-key -- "<label>"` (as
echorank/root, prints the key once). Scopes do not overlap: a partner key gets 403 on
`/api/public/v1/*`, a public (SEO Tools) key gets 403 here. No paid-plan check. Every call
carries `x-partner-subject`: the partner's opaque id for its own customer
(`^[A-Za-z0-9_-]{1,64}$`, never an email).

| Status | Body `error` | When |
|---|---|---|
| 401 | `missing_bearer_key` / `invalid_or_revoked_key` | no key, unknown key, revoked key |
| 403 | `wrong_scope` | key without scope `partner` |
| 400 | `missing_partner_subject` / `invalid_partner_subject` | header absent or not an opaque id |
| 400 | `invalid_url` (+ `reason`), `invalid_mode`, `invalid_competitors`, `invalid_question`, `invalid_business`, `no_supported_engine` | input |
| 422 | `site_unreachable` | the audited site could not be fetched |
| 429 | `rate_limited` (+ `scope`, `retryAfter`, `Retry-After` header) | `subject_hour` or `month_<kind>` |
| 502 | `upstream_error` | sidecar failed; the call's allowance is given back |
| 503 | `quota_unavailable` | Redis unreachable (fails closed) |

**Endpoints.**

- `POST /v1/audit` `{ url, mode: "quick"|"full" }` (mode defaults to quick). Sidecar `/audit`
  with `crawl: false|true`. URLs go through the SSRF guard (`bot-analytics/url-guard.ts`:
  http(s) only, no IP literals, no credentials, ports 80/443, no private suffixes or
  single-label hosts). Stored as a `VisibilityAudit` on the partner tenant
  (`monitorId` null), ledgered in `partner_calls` with the subject. Returns:
  ```
  { id, url, mode, score, grade,
    rendering: { likelyCsr, textLength, framework } | null,
    robotsTxt: boolean,
    crawlers: [{ engine, vendor, status: "ALLOWED"|"BLOCKED", scored, detail }],   // scored engines first
    checks:   [{ key, label, score, max, detail, recommendation }],
    createdAt }
  ```
  Check keys: `robots`, `rendering`, `structured_data`, `sitemap`, `head`, `headings`,
  `content` (a new sidecar label falls back to its slug).
- `GET /v1/audit/:id`: an audit this key created (quick, full or benchmark), else 404. Another
  key on the same tenant gets 404 too.
- `POST /v1/visibility/query` `{ question, business, website?, engines? }`. The tracked-prompt
  answer check (sidecar `/track`, the call the visibility-monitoring worker makes): brand terms
  = business name + the website's domain root, two prompts (the question, and "what is
  <business> (<host>)"). Returns
  `{ mentioned, answer_excerpt, engines: [{ engine, model, mentioned, answer_excerpt }], description, costUsd, unsupportedEngines? }`.
  Engines today: `claude` only; requested engines we cannot ask come back in
  `unsupportedEngines`, never as a fake answer. `costUsd` is a ceiling (the sidecar reports no
  token usage, so each answer is priced at `max_tokens` 700 with `ai-monitor/pricing.ts`
  rates); the same figure is stored on the `partner_calls` row.
  Alias: `POST /api/v1/visibility/query` (same handler, same auth), for EchoPilot's original
  base `https://echorank360.com/api`. Remove it once no caller uses that base.
- `POST /v1/benchmark` `{ you, competitors: [≤5 urls], mode: "quick" }`. Quick audits of all,
  in parallel. Returns `{ mode, you, competitors, createdAt }`, each entry either the
  dashboard benchmark's summary plus the audit (`{ url, score, grade, blocked, botTotal, audit }`)
  or `{ url, error }`. One benchmark call counts once against `benchmark`, not per URL.

**Limits** (`src/lib/partner/limits.ts`; Redis, `src/lib/partner/quota.ts`, the site-audit
quota shape). Per key per UTC month: `audit_quick` 2,000 · `audit_full` 300 · `query`
3,000 · `benchmark` 300. Per subject: 60 requests per UTC clock hour across every endpoint,
including GET. Per-subject monthly counters (`echorank:partner:subject:*`) are kept for
metering and never refuse.

**Cost.** Every call that ran writes a `partner_calls` row (`kind`, `subject`, `auditId`,
`costUsd`, `ok`). Audits spend nothing upstream (`costUsd` 0, logged anyway); queries log the
ceiling above. Spend per subject:
`SELECT subject, sum("costUsd") FROM partner_calls WHERE "createdAt" >= date_trunc('month', now()) GROUP BY 1;`

**Versioning.** Within v1, changes are additive only: new fields, new optional inputs, new
endpoints. Removing or renaming a field, changing a type or a status code means `/v2`.

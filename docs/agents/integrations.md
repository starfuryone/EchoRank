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

## Email / SMS

`SMTP_*` empty, `BREVO_API_KEY` absent though `/api/webhooks/brevo` exists, Twilio
partially configured. Campaigns, review requests, digests and alerts are inert. Treat any
"send" path as unexercised in production.

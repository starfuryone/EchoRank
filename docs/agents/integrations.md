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

## Stripe — no checkout, deliberately

As of late July 2026 there is **no checkout and no billing portal**. `src/lib/stripe/`
contains only `prices.ts`. There is no `checkout.sessions.create` and no
`billingPortal.sessions.create` anywhere in `src/`.

Consequence: the billing page's plan switch changes `planType` **without taking payment**.

Do **not** "helpfully" wire payments. Building checkout is its own task with its own
explicit go-ahead. `scripts/seed-plan-prices-usd.ts` exists, is idempotent, and aborts on an
empty key by design — it has never run.

Webhook signature verification is implemented and correct; the absence of
`STRIPE_WEBHOOK_SECRET` is handled explicitly rather than silently.

## AI providers

`AI_PROVIDER="mock"` in `.env`. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are empty on the
web app, so every `ai_analysis` surface falls back to heuristics — by design, and the copy
tells the user when it happened rather than failing. The av-service sidecar carries its own
key.

## Email / SMS

`SMTP_*` empty, `BREVO_API_KEY` absent though `/api/webhooks/brevo` exists, Twilio
partially configured. Campaigns, review requests, digests and alerts are inert. Treat any
"send" path as unexercised in production.

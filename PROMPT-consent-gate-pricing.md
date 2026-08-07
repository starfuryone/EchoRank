# Task: Consent-gated trial checkout on /pricing (modeled on AgoraIQ pricing.html)

Repo: /opt/echorank/app (Next 16 / Turbopack, Prisma client at src/generated/prisma). Investigate before assuming; do not deploy — build/pm2/CF purge are operator steps.

## Goal
Before any "Start 7-day trial" checkout from `/[locale]/pricing` (and the homepage `PricingSection`), the user must explicitly accept the legal documents. Consent is validated server-side and persisted with version, document IDs, timestamp, and plan — matching §8 of the Subscription Agreement.

## Reference behavior (AgoraIQ, adapt not copy)
- Consent checkbox row rendered below the plan cards: "I agree to the [Subscription Agreement], [Terms of Use], [Privacy Policy], and [Cookie Policy]" — links open in new tab.
- Clicking a plan CTA with the box unchecked does NOT disable buttons; it opens an "Agreement Required" modal listing the documents with a button that closes the modal and smooth-scrolls to the checkbox.
- On checkout, the client sends `consent: { accepted: true, timestamp, version, documents: [ids] }` with the request.

## Deviations from the AgoraIQ implementation (deliberate)
1. **No consent-config API endpoint.** AgoraIQ fetches `/billing/consent-config` at runtime with a fail-closed error path. We use a single typed config instead — no fetch, no failure mode:
   - `src/lib/consent-config.ts`: `CONSENT_VERSION` (date-stamped string, start at `"2026-08"`), `CONSENT_DOCUMENTS: { id, labelKey, href }[]` for `subscription_agreement`, `terms`, `privacy`, `cookies`. Imported by both the client component and the checkout route — single source of truth, same pattern as seo-tools.ts.
2. **No "No Financial Advice" document** — that's AgoraIQ-only. Echorank list is exactly the four above.
3. Styling: use the existing pricing-page CSS patterns/tokens. Do NOT import AgoraIQ styles; the Binance re-theme is a separate task.

## Work items

### 1. Legal pages
- Content files at repo root: `echorank360-subscription-agreement.md` and `echorank360-cookie-policy.md` (Aug 2026 drafts). Render them at legal routes consistent with the existing `legal/terms` pattern — investigate how terms/privacy pages are currently built (static TSX? markdown?) and match it. EN body first pass; locale chrome only for fr/de catalogs (existing convention). Use the same "Last updated" date as the Terms edit for consistency.
- Add both pages to sitemap + footer legal links if the other legal docs are there.
- Terms of Use Eligibility section: already shipped (d680af2) — do not redo.

### 2. Client consent gate
- Visual (match the AgoraIQ reference): one full-width rounded card spanning the pricing grid, directly below the plan cards — subtle surface background + 1px border, centered content. Left: checkbox (~18px, accent-colored). Right: single sentence "I agree to the Subscription Agreement, Terms, Privacy, and Cookies" with the document names as links in the site accent color, muted text otherwise, `target="_blank"`. One line on desktop, wraps naturally on mobile. Use Echorank's current pricing-page tokens for surface/border/accent (Binance re-theme will restyle it later — no hardcoded AgoraIQ cyan).
- New client component `ConsentGate` (or inline in `PricingSection.tsx` if cleaner): checkbox + sentence built from `CONSENT_DOCUMENTS` (never hardcode the doc list in JSX), plus the "Agreement Required" modal.
- Consent state lives in `PricingSection`; every plan CTA path (logged-in upgrade checkout AND guest checkout) must pass through `requireConsent()` before hitting the API.
- i18n: consent sentence + modal strings in all app catalogs.

### 3. Server validation — `/api/billing/checkout`
- Zod-validate the `consent` object: `accepted === true`, `version === CONSENT_VERSION`, `documents` contains every id in `CONSENT_DOCUMENTS`. Reject with 400 `{ error: "consent_required" }` otherwise. Applies to both the logged-in branch and the guest branch (flow=guest_signup).

### 4. Persistence — `ConsentEvent`
- New Prisma model: `id, tenantId?, userId?, email?, stripeSessionId?, version, documents (Json), plan, interval, flow ("guest_signup"|"upgrade"|...), createdAt`. Additive migration; remember the repo gotcha — DB user can't create a shadow DB, so apply via psql + `prisma migrate resolve --applied`.
- Logged-in checkout: write the ConsentEvent at session creation (tenantId/userId known).
- Guest checkout: userId doesn't exist yet. Put `consent_version`, `consent_ts`, `consent_docs` in the Checkout Session metadata; the webhook writes the ConsentEvent when it provisions user+tenant on `checkout.session.completed` (idempotent — key on stripeSessionId, unique constraint).

### 5. Tests
- Consent sentence renders one link per config document (mutation-check: add a doc to config → test fails if hardcoded).
- Checkout 400 on: missing consent, accepted=false, stale version, missing doc id.
- Guest flow: metadata carries consent; webhook creates exactly one ConsentEvent on replayed events.
- Existing checkout tests still green.

## Constraints
- Do not create new API routes for consent; extend the existing checkout route + webhook.
- Do not touch the free-audit funnel or its "no account needed" claims.
- Commit with the usual `.bak.$TS` discipline; report deploy line at the end (build + pm2 restart echorank360-web + echorank360-workers if webhook changed + CF Purge Everything).

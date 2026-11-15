# PROMPT-PANEL-BUILDER.md — Upgrade Custom Prompts into the Prompt Panel Builder

Read AGENTS.md and CLAUDE.md first. This spec was written **without repo access**: file, model and
function names below come from project history and may be stale. Where the code differs, follow
the code, keep the intent, and list the deviation in your final report.

## Goal

Turn the existing **Custom Prompts** tool (SEO Tools hub → Search Marketing, and the link-out on
the AI Visibility page) into a guided **Prompt Panel Builder** that implements AEO course
Lesson 4 (`/[locale]/learn/aeo/build-your-prompt-panel`):

> A prompt panel is a fixed set of real buyer questions, asked the same way, on the same answer
> engines, on a schedule.

Flow: **Setup → Draft → Check → Freeze → Baseline → Track**. Existing tenant prompts, PromptTrends,
`recordPromptAlerts()` / `sendPromptAlertDigest()` and scheduled monitoring must keep working.

Conventions that apply throughout:
- Heuristics first; the LLM is used only for drafting (and the free generator).
- The authenticated dashboard uses the LIGHT Tailwind theme (bg-gray-50, Card/Button/Input). The
  `--bg/--surface` dark tokens are marketing-only. The free tool page uses the public-site Binance
  tokens, like the other `/free-tools/*` pages.
- Branding: "Echorank" only, never CamelCase.
- Tenant isolation: tenantId always comes from the session (`requireTenant`), never from the body
  or query. Every `[id]` route checks ownership.
- All UI strings go through the app i18n catalogs: en, en-CA, fr, fr-CA, de-CH. Write real French
  and real German, not English placeholders.
- Prisma client is `src/generated/prisma`.
- Migrations must be **additive only**. The DB user cannot create a shadow DB, so `migrate dev`
  fails. Hand-write the SQL (or use `prisma migrate diff --script`), apply it with psql, then run
  `prisma migrate resolve --applied <name>`.
- Commit at the end of each phase on the current branch. `tsc` must be clean and the full suite
  green before each commit.
- **Do not build or restart under the running process.** Deploy is Frederic's step as root (see
  the end of this file).

---

## Phase 0 — Investigate (read-only, then continue)

Find and report in a few lines each:
1. The Custom Prompts route(s), page component and API routes. Is it a real surface or a scaffold?
2. The prompt model (tracked/visibility prompt) and the answer/result model. Does the answer model
   store full answer text, cited sources, engine, model id and locale?
3. The provider abstraction for answer engines (OpenAI / Gemini / Claude Haiku 5.5 / others), the
   BullMQ queue and worker that run prompts, and where mention detection lives.
4. AI allowances in `src/lib/plan-config.ts` (prompts, providers, inferences per month, USD cap,
   cadence) for every tier, including AI_VISIBILITY if present in this tree. Also the per-tier
   **location** allowance.
5. AI metering: where inference counts and USD spend are recorded, and the **observed average cost
   per answer run** over the last 30 days. Report this number.
6. Data sources for drafting: review model (imported reviews), Recovery tickets model, `GscQueryStat`,
   Intelligence competitors model, GBP Monitor data, and where the Industry Prompt Setup Guides
   content lives (shipped Nov 13).
7. The AEO course content config and the worksheet page (`/learn/aeo/worksheet#sheet-baseline`):
   the exact baseline-sheet column headers.
8. The free-tools hub config, the lead-capture model used by the free AI Visibility Check
   (email-gated), `src/proxy.ts` `publicPaths` / `publicExactPaths`, the Redis rate-limit helper,
   `csv-export.ts` / `ExportCsvButton`, and `LOCALIZED_ROUTES` in `src/lib/seo/registry.ts`.

**Stop conditions (report and stop):**
- No real prompt-tracking backend exists (no prompt model or no runner). Stop after Phase 0.
- Any required migration would be non-additive (rename, drop, type change on populated columns).

Otherwise continue without asking.

---

## Phase 1 — Data model

Extend existing models rather than building parallel tables, so trends and alerts keep working.
Create new tables only where nothing exists yet.

**New enums**
- `PromptType`: UNBRANDED, COMPARISON, BRANDED, FACT_CHECK
- `JourneyStage`: PROBLEM, SOLUTIONS, COMPARE, VERIFY
- `PanelRunStatus`: QUEUED, RUNNING, COMPLETED, FAILED, PARTIAL
- `FactCheckStatus`: MATCH, MISMATCH, UNVERIFIABLE
- `BrandFactKind`: HOURS, PRICE, PHONE, ADDRESS, URL, TEXT
- `BrandFactSource`: MANUAL, GBP

**New `PromptPanel`**
- Core: id, tenantId, name, subject (the product or location the panel covers), locale, language.
- Run settings: engines (string[]), repeatsPerCycle (int, default 2, range 1–5), cadence (reuse the
  existing cadence enum/value; default weekly).
- Freeze state: status (DRAFT | FROZEN), frozenAt.
- Baseline: baselineRunId (nullable, unique).
- Bookkeeping: createdAt, updatedAt.
- Index on (tenantId).

**Extend the existing prompt model** (all new columns nullable or defaulted)
- Panel fields: panelId (FK), code (e.g. `SOL-03`), type `PromptType?`, stage `JourneyStage?`.
- Lifecycle: frozenAt, retiredAt, retireReason, supersedesId (self-FK).
- factKeys (string[]; fact-check prompts only).
- Unique (panelId, code).

**New `PanelRun`**
- id, panelId, tenantId, cycle (int).
- isBaseline, status.
- Snapshots taken at run start: engines, repeatsPerCycle, promptCount.
- startedAt, completedAt, archivedAt (an archived baseline is kept, never deleted).

**Extend the existing answer model**
- Run link: panelRunId (FK, nullable), repeatIndex.
- Context: locale, language, loggedIn (bool, default false; API runs are always logged out).
- Content: the full answer text and sources as JSON/URL list. Add these only if missing.
- Analysis: mentioned, mentionPosition (nullable), competitorsNamed (string[]).
- Fact check: factCheckStatus, factCheckNote, factCheckOverride (nullable, set by user).

**New `BrandFact`**
- id, tenantId, panelId (nullable = tenant-wide), key, label, value, kind `BrandFactKind`, source
  `BrandFactSource`, updatedAt.

**Codes**
- Prefix by stage: PROBLEM→`PRB`, SOLUTIONS→`SOL`, COMPARE→`CMP`, VERIFY→`VER`. Two-digit counter
  per panel per prefix (`SOL-03`), widening to three digits past 99.
- Codes are **never reused**, retired and superseded prompts included. Next = max existing + 1,
  computed inside a transaction, with retry on unique violation.

**Backfill of existing prompts.** Per tenant with prompts, create one DRAFT panel named
"Default panel" with the tenant's locale and current engines, and attach the prompts with null
type/stage. Codes are assigned when a prompt is labeled. Existing answers keep panelRunId null and
still feed PromptTrends. Backfill via a one-off script committed under `scripts/`, idempotent, run
by you after the migration is applied. Report the counts.

---

## Phase 2 — Panel checker (pure module, fully unit-tested)

`src/lib/prompt-panel/lint.ts` → `lintPanel(panel, prompts, brandTerms) → Issue[]`, where
`Issue = { rule, severity: 'error'|'warn'|'hint', promptId?, message }`. Only active prompts count
(not retired).

**Brand terms:** tenant brand name, domain stem, product names, plus any extra terms the user adds
on the panel (store them as `PromptPanel.brandTerms string[]`, part of the same migration).
Matching is case-insensitive, diacritics-folded, word-boundary.

| Rule | Severity | Check |
|---|---|---|
| E-UNLABELED | error | prompt has no type or no stage |
| E-BRAND-IN-UNBRANDED | error | UNBRANDED prompt contains a brand term |
| E-BRANDED-NO-BRAND | error | BRANDED or FACT_CHECK prompt contains no brand term |
| E-FACTCHECK-NO-FACT | error | FACT_CHECK prompt has no factKeys |
| W-UNBRANDED-SHARE | warn | unbranded < 50% of active prompts |
| W-SIZE | warn | active count outside 20–30 |
| W-STAGE-COVERAGE | warn | any stage has < 5 prompts |
| W-NEAR-DUPLICATE | warn | normalized token Jaccard ≥ 0.8 between two prompts |
| H-NO-CONSTRAINT | hint | no number, place, team/company size, budget, timeframe, audience ("for a…", "near…", "under $…", fr/de equivalents) |
| H-LENGTH | hint | < 5 words or > 40 words |

COMPARISON prompts may name the brand (lesson example: "Lumen CRM or a bigger suite…").

Tests: every rule, both polarities, plus fr and de-CH inputs with accents.

---

## Phase 3 — Drafting

**`src/lib/prompt-panel/sources.ts`** gathers raw material for the tenant. Each source is optional
and silently skipped when empty:
- Up to 200 most recent review texts and Recovery ticket texts, truncated to 400 chars each.
- GSC queries that are question-shaped. Leading-word regex per language:
  - en: who/what/which/how/best/is/does/can/should/vs
  - fr: qui/quel/quelle/comment/meilleur/est-ce
  - de: wer/was/welche/wie/beste
- Intelligence competitors (names).
- The chosen Industry Prompt Setup Guide's prompts.

**PII scrub** before anything leaves the box: strip emails, phone numbers and URL query strings.
Cap the total material at about 6k tokens, newest first.

**`POST /api/ai/visibility/panels/[id]/draft`**
- Input: business description, subject, industry (guide key), competitors (prefilled), locale.
- Model: Claude Haiku 5.5 via the existing Anthropic client and model constant. Do not hardcode a
  second model string.
- Output must be zod-validated JSON: `[{ wording, type, stage, rationale, sourceKind }]`.
- Target mix (from the lesson's worked example): 24 prompts = 14 unbranded, 4 comparison,
  3 branded, 3 fact-check, with at least 5 per stage. Prompts are written in the buyer's words,
  in the panel language, with a realistic constraint, and without product terms in unbranded
  prompts.
- Results are saved as unfrozen draft prompts. The checker runs on the result and the UI shows
  its issues.
- **Fallback (no key, API error or invalid JSON):** deterministic drafts from the industry guide
  plus competitor templates. Never fail empty-handed.
- Metering: tokens count against the tenant's AI USD cap through the existing metering.
- Limit: 5 drafts per panel per day (Redis).

Users can also add prompts manually, or import a guide library and rewrite it. The UI should nudge:
"Rewrite every prompt in your buyers' words."

---

## Phase 4 — Freeze, version, retire

- **Freeze** (`POST …/panels/[id]/freeze`) is refused while any `error` issue exists. It assigns
  codes and sets frozenAt on the panel and all active prompts.
- **Frozen wording is immutable.** A PATCH changing wording, type or stage on a frozen prompt
  returns 409.
- **"Test new wording"** creates a new prompt with supersedesId set and a new code. It is frozen
  on creation, has no baseline, and its trend starts at its first run. Both prompts stay active
  until the user retires one.
- **Retire** requires a reason (min 10 chars) and sets retiredAt. The prompt is excluded from runs
  and counts and kept in history. UI hint: "Retire a prompt only when its decision no longer
  matters to the business."
- **Hard delete** is allowed only for never-run draft prompts.
- Adding a new prompt to a frozen panel is allowed (new code, frozen on creation). Use case: new
  product or new market.

---

## Phase 5 — Baseline and runs

- **Run baseline** (`POST …/panels/[id]/runs` with `{ baseline: true }`) is enabled only when the
  panel is frozen and has no baseline. One PanelRun = active prompts × engines × repeats, enqueued
  on the existing AI visibility queue/runner (one job per prompt × engine × repeat). Status rolls
  up QUEUED → RUNNING → COMPLETED / PARTIAL / FAILED.
- **The baseline is locked.** "Reset baseline" needs a confirm plus a reason. It sets archivedAt on
  the old run (kept, still viewable) and allows a new baseline.
- **Engines and repeatsPerCycle are locked once a baseline exists.** Changing them requires a
  baseline reset. Lesson rule: keep the repeat count constant and judge trends across cycles.
- **Scheduled cycles:** after the baseline, each cadence tick creates a PanelRun with cycle n+1
  through the existing scheduled monitoring. Mind the known BullMQ trap: the repeat key includes
  the interval, and Redis returns `every` as a string, so compare numerically.
- **Quota guard before enqueue:** runs needed = active prompts × engines × repeats. If that exceeds
  the remaining monthly allowance, refuse the whole run with a clear message. No partial enqueue.
- **Logging per answer:**
  - Run context: engine, model id, locale, language, timestamp, loggedIn = false.
  - Content: full answer text, cited sources.
  - Analysis: mentioned (reuse the existing detection), mentionPosition (if the existing logic can
    rank, else null), competitorsNamed (matched against the tenant's competitor list).
- **Fact check** (FACT_CHECK prompts) is a heuristic against linked BrandFacts:
  - Normalize per kind: time ranges for HOURS, currency amounts for PRICE, digits for PHONE,
    lowercase/strip for ADDRESS/URL/TEXT.
  - MATCH if the fact value is present.
  - MISMATCH if a value of the same kind is present and different.
  - Otherwise UNVERIFIABLE.
  - The UI labels it "Auto-check" with a user override.
- **Brand Facts editor** on the panel: add, edit and delete facts. "Import from GBP Monitor"
  prefills hours, address, phone and website when GBP data exists.
- **Alerts:** call the existing `recordPromptAlerts()` when a prompt's unbranded mention rate drops
  versus the baseline, and when a fact-check flips to MISMATCH. Reuse the digest.

---

## Phase 6 — UI

Keep the existing Custom Prompts URL. Panel list at the root (with a "New panel" button, capped by
the plan) and panel detail at `…/[panelId]` with tabs:

1. **Setup:** name, subject, locale, engines (limited to plan providers), repeats, cadence, extra
   brand terms. Shows a live estimate: "≈ N runs per cycle, ≈ M per month" against the remaining
   allowance across all of the tenant's panels. Blocks saving if the monthly estimate exceeds it.
2. **Draft:** Generate (with source checkboxes showing counts, e.g. "Reviews (183)",
   "GSC questions (12)"), import a guide library, or add manually. Editable table: wording, type,
   stage, factKeys.
3. **Check:**
   - Type-mix bar (unbranded share highlighted, 50% line).
   - Stage coverage (4 counters, min 5).
   - Size meter (20–30 band).
   - Issues list grouped by severity; clicking an issue focuses the prompt.
   - Freeze button, disabled while errors exist.
4. **Baseline:** run button, progress, and the banner "Don't change your site until the baseline is
   recorded." Locked state after completion.
5. **Results:**
   - **KPIs per type, never blended:** Unbranded mention rate (headline), Comparison mention rate +
     average position, Branded mention rate, Fact-check match rate. Each shows current cycle vs
     baseline delta.
   - Per-stage breakdown.
   - Engine filter.
   - Prompt table: code, stage, type, mention rate this cycle, Δ vs baseline, PromptTrends
     sparkline with a baseline marker.
   - Row click opens an answers drawer: full text and sources per engine and repeat.
6. **Facts:** Brand Facts editor.

Retired prompts are visible behind a "Show retired" toggle, with date and reason. Use the lesson's
definitions as tooltips (paraphrased, in your own words).

Update the Custom Prompts card copy in `src/lib/seo-tools.ts` to "Prompt Panel Builder". Keep the
key and route stable so `npm run test:seo-tools` and the route table stay green, or update the
test deliberately and say so.

---

## Phase 7 — Export

Via `csv-export.ts` (BOM, RFC 4180, formula-injection guard) and `ExportCsvButton`.
`GET …/panels/[id]/export?kind=` accepts:
- `panel`: code, type, stage, wording, frozenAt, retiredAt, retireReason, supersedes.
- `baseline`: **exact column headers of the AEO worksheet's `sheet-baseline`** (from Phase 0).
- `answers` (`?format=csv` streaming, 50k row cap): run, cycle, isBaseline, code, engine, model,
  locale, language, date, loggedIn, mentioned, position, competitorsNamed, factCheck, sources,
  answerText.

Same gating as the JSON routes.

---

## Phase 8 — Free "Prompt Panel Generator" (`/[locale]/free-tools/prompt-panel`)

- **Inputs:** brand name or URL, industry (guide list), location (optional), up to 3 competitors,
  language.
- **Anonymous API `POST /api/av/prompt-panel`:**
  - Add to `publicExactPaths` in `src/proxy.ts`. The CSRF origin check still runs.
  - Rate limits in Redis: 1 generation per IP per 24h, plus a global daily generation budget
    (env-configurable, default 300/day).
  - Reject a missing `cf-connecting-ip` with 403. No shared 'unknown' bucket.
  - Quota counts only on success.
  - Uses the same drafting core (Haiku, tight max_tokens, deterministic fallback). No answer-engine
    runs, draft only.
- **Result:** the 24 prompts with type/stage labels and the checker summary.
- **Download:** CSV download (panel format) gated by email, reusing the AI Visibility Check's
  lead-capture model/flow with source tag `prompt-panel`.
- **CTA → `/[locale]/pricing`** (site rule: marketing CTAs go to pricing cards). Copy along the
  lines of "Track this panel weekly — cancel anytime."
- **Carry-over:**
  - Store the draft server-side (`PanelDraft`: id, prompts JSON, locale, createdAt; delete after
    30 days via the existing sweep or a small repeatable job) and set a first-party cookie with
    its id, 30 days.
  - When a logged-in tenant opens Prompt Panel Builder with no frozen panels and the cookie is
    present, offer "Import your draft panel", which creates a DRAFT panel from it. Clear the
    cookie after import.
- **Wiring:** add to the free-tools hub config, `LOCALIZED_ROUTES` (sitemap 0.6), and nav wherever
  free tools are listed. Binance tokens on the public page.

---

## Phase 9 — Course and guides integration

- Lesson 4 page: add a CTA block "Build your panel in Echorank". Logged out → free generator;
  logged in → Prompt Panel Builder.
- Industry Prompt Setup Guides (hub + each guide page): "Use this library in the Panel Builder" →
  free generator with `?industry=<key>` preselected.

---

## Plan gating

| Item | Rule |
|---|---|
| Panels per tenant | = the plan's location allowance (lesson: one panel per product or location). If plan-config has no location allowance, fall back to AI_VISIBILITY 1, STARTER 1, GROWTH 3, AGENCY 20, ENTERPRISE 20, and report it. |
| Active prompts per panel | max 30 on every tier (replaces the old 10-prompt cap) |
| STARTER (and AI_VISIBILITY if present) monthly inferences | raise 200 → **550**. A full 30-prompt panel × 2 engines × 2 repeats × weekly ≈ 520 runs/mo. |
| STARTER / AI_VISIBILITY USD cap | new cap = max(current, ceil(2 × 550 × observed cost per run from Phase 0)). Report the old and new values. |
| GROWTH / AGENCY / ENTERPRISE | never lower; ensure ≥ 550 inferences. Do **not** raise further: report current values and what a full allocation (panels × 30 × engines × 2 × 4.33) would need, so Frederic decides. |
| Drafting | counts against the AI USD cap; 5 per panel per day |
| Free generator | anonymous, limits as Phase 8 |

Never-paid or non-ACTIVE tenants follow the existing guard (`requirePaidPlan` / `requireFeature`),
whichever Custom Prompts uses today.

---

## Tests (add to the suite)

- **lint:** every rule, both polarities, accents (fr, de-CH).
- **codes:** stage prefixes, monotonic, never reused after retire or supersede, concurrent-create
  retry.
- **freeze:** blocked with errors; PATCH wording on frozen → 409; "Test new wording" creates a
  linked prompt with a new code.
- **baseline:** a second baseline is refused; reset archives the old one; engines/repeats locked
  after baseline.
- **quota guard:** a run over the remaining allowance is refused whole, with nothing enqueued.
- **fact-check heuristic:** MATCH / MISMATCH / UNVERIFIABLE for each kind.
- **PII scrub:** emails, phones, query strings.
- **drafting:** invalid LLM JSON → deterministic fallback used.
- **export:** baseline CSV headers equal the worksheet headers exactly.
- **tenant isolation:** another tenant's panel id → 404 on every `[id]` route.
- **anonymous route:** public via proxy, 403 without cf-connecting-ip, 1/IP/day, quota not burned
  on failure.
- **backfill script:** idempotent (running it twice is a no-op).
- **registry / seo-tools / nav tests** updated for new routes.

---

## Final report (print at the end)

1. Phase 0 findings (short), including observed cost per run and the per-tier allowance table
   (before → after).
2. Commits (hash + one line each), migration name(s), backfill counts.
3. Test count before → after, tsc status.
4. Every deviation from this spec, and why.
5. Open questions for Frederic (higher-tier allowance numbers, anything ambiguous found).
6. **Deploy block for Frederic to run as root**, in this order:
   ```
   cd /opt/echorank/app
   NODE_OPTIONS=--max-old-space-size=1536 npm run build
   chgrp -R echorank .next/server/app .next/cache && chmod -R g+w .next/server/app .next/cache
   pm2 restart echorank360-web
   pm2 restart echorank360-workers
   ```
   Then Cloudflare **Purge Everything**, after the build has succeeded, never before.
7. **Smoke test:**
   - Asturia tenant → Prompt Panel Builder.
   - Default panel present with migrated prompts → label them → Check → Freeze.
   - Run baseline; watch `pm2 logs echorank360-workers`; confirm answers carry full text +
     sources.
   - Results show four separate type KPIs.
   - Export the baseline CSV.
   - Logged out: `/en/free-tools/prompt-panel` generates once, second try same day is
     rate-limited, CTA goes to `/en/pricing`.

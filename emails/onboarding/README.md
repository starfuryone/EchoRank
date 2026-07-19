# Onboarding email templates (Brevo)

These `.html` files are the CONTENT for eight Brevo transactional templates
(4 stages × en/fr). They are uploaded to Brevo manually — the app never calls
Brevo's template-creation API. At send time the worker
(`src/infrastructure/queue/workers/onboarding-email.worker.ts` →
`src/lib/onboarding-email.ts`) calls `POST https://api.brevo.com/v3/smtp/email`
with a `templateId` and `params`; Brevo renders the template with those params.

## Upload steps

1. Brevo → Campaigns → Templates → New template → "Paste your code".
2. Paste the file content, set the subject (suggestions below), save & activate.
3. Copy the numeric template ID from the URL/list into the matching `.env` key.

| File | Suggested subject | .env key |
|---|---|---|
| `d0-score-recap.en.html` | Your first AI Visibility results | `BREVO_ONBOARDING_D0_EN_ID` |
| `d0-score-recap.fr.html` | Vos premiers résultats de visibilité IA | `BREVO_ONBOARDING_D0_FR_ID` |
| `d2-checklist-nudge.en.html` | One step to get more from EchoRank | `BREVO_ONBOARDING_D2_EN_ID` |
| `d2-checklist-nudge.fr.html` | Une étape pour tirer plus d'EchoRank | `BREVO_ONBOARDING_D2_FR_ID` |
| `d5-competitors.en.html` | Who AI recommends instead of you | `BREVO_ONBOARDING_D5_EN_ID` |
| `d5-competitors.fr.html` | Qui l'IA recommande à votre place | `BREVO_ONBOARDING_D5_FR_ID` |
| `d10-trial-reminder.en.html` | Your trial + your PDF report | `BREVO_ONBOARDING_D10_EN_ID` |
| `d10-trial-reminder.fr.html` | Votre essai + votre rapport PDF | `BREVO_ONBOARDING_D10_FR_ID` |

Also required in `.env`: `BREVO_API_KEY` (a transactional API key).
Optional: `ONBOARDING_EMAIL_DRY_RUN=1` makes the worker log full payloads
instead of sending (sends are also suppressed whenever `NODE_ENV !== "production"`).

## Params reference

Every numeric/data param ships with a `has*` boolean; templates must gate on it
(`{% if params.hasScore %}`) so no invented numbers ever render.

Common (all stages): `firstName`, `brand`, `hasScore`, `score`, `grade`,
`topFixTitle`, `topFixAction`, `visibilityUrl`, `dashboardUrl`.

- **d2**: `doneCount`, `totalCount`, `nextStepLabel` (pre-localized by the
  worker), `nextStepUrl`.
- **d5**: `hasCompetitors`, `competitorNames` (comma-separated, from real
  PromptRun data), `isGrowthPlus`, `ctaUrl` (intelligence page for GROWTH+,
  billing otherwise).
- **d10**: `hasTrialEnd`, `trialEndDate` (locale-formatted; only present while
  `billingStatus = TRIALING` with a real `Subscription.currentPeriodEnd`).

`{{ unsubscribe }}` is Brevo's native unsubscribe URL. The webhook
(`/api/webhooks/brevo`) flips `Tenant.marketingConsent` to false on
`unsubscribed` events, and the worker re-checks it before every send.

## Send logic (for reference)

Jobs are enqueued at signup with delays d0=+3h, d2=+2d, d5=+5d, d10=+10d and
jobIds `onboarding-<tenantId>-<stage>`. Before sending, the worker skips when:
tenant deleted; `marketingConsent=false`; d2 with ≥2 checklist items done;
d10 when no longer trialing. Locale comes from `Tenant.defaultLanguage`
(fr → `_FR_` template, everything else → `_EN_`).

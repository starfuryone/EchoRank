# Onboarding email templates: SUPERSEDED (2026-11-14)

The `.html` files in this folder are **no longer used**. They were the content
for eight Brevo transactional templates (4 stages × en/fr) that had to be pasted
into Brevo by hand and referenced from `.env` (`BREVO_ONBOARDING_*_ID`). They
were never uploaded: the Brevo account holds no templates, so no onboarding
email could render.

The emails are now rendered in the repo by
`src/lib/onboarding-email-render.ts` and sent by `src/lib/onboarding-email.ts`
as `htmlContent` + `textContent` through the same endpoint,
`POST https://api.brevo.com/v3/smtp/email`. Nothing depends on a template stored
in Brevo, and the `BREVO_ONBOARDING_*_ID` variables are no longer read.

Each email carries a "See your plan" button (`planUrl`, falling back to
https://echorank360.com/plan), the ECHORANK™ wordmark, "Cancel anytime", and
the footer (unsubscribe, privacy, terms, the company line). Tests:
`tests/onboarding-email-html.test.ts`.

These files can be deleted; they are kept only until someone with the right to
remove files does so. Do not upload them to Brevo: they predate the brand rule
(they say "EchoRank 360") and the d10 rewrite (they still carry a trial date).

## Still needed in `.env`

`BREVO_API_KEY` (a transactional API key). `ONBOARDING_EMAIL_DRY_RUN=1` makes
the worker log the payload instead of sending (sends are also suppressed
whenever `NODE_ENV !== "production"`).

## Send logic

Jobs are enqueued at signup (`src/lib/onboarding-drip.ts`) with delays
d0 = +3 h, d2 = +2 d, d5 = +5 d, d10 = +6 d, and job ids
`onboarding-<tenantId>-<stage>`. Before sending, the worker skips when: tenant
deleted; `marketingConsent = false`; the plan has no AI visibility; d2 with ≥ 2
checklist items done; d10 when no longer trialing. Locale comes from
`Tenant.defaultLanguage` (fr → French, everything else → English). The sender
is `noreply@echorank360.com`.

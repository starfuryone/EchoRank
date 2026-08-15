// src/lib/revenue/disclaimer.ts
//
// The one estimate disclaimer, in one place.
//
// It was written for the homepage ROI calculator and lived inline in
// src/app/[locale]/HomeClient.tsx (T.en.roi.note / T.fr.roi.note). The AI
// Revenue Dashboard shows estimated money too and has to carry the same
// promise, so the sentence is lifted here and both surfaces read it rather than
// each keeping a copy that drifts.
//
// ── Why the dashboard gets the SENTENCE and not the whole note ──────────────
// The homepage note also states the assumptions the calculator hard-codes:
// "~35% of local purchase decisions now touch an AI answer, 30% close rate on
// AI-referred leads". The revenue dashboard uses neither — it runs on the
// tenant's OWN convRate and avgSaleValue from /settings/account. Reusing the
// full note there would tell a tenant who set convRate to 0.45 that we assumed
// 0.30, which is worse than no disclaimer: it is a false statement about their
// own numbers. So the assumptions clause stays on the homepage, where it is
// true, and only the promise travels.
//
// NO IMPORTS, deliberately. dashboard.ts reads this module to build
// REVENUE_COPY, so anything imported here would be a cycle back through the
// i18n barrel.

/**
 * What an estimate on this platform is worth. Keyed by dashboard locale.
 *
 * de-CH per the house rule: **ss**, never **ß** — this string happens to need
 * neither, and the next translator should keep it that way.
 */
export const ESTIMATE_DISCLAIMER = {
  en: "Directional, not a guarantee.",
  fr: "Indicatif, sans garantie.",
  "de-CH": "Richtwert, keine Garantie.",
} as const;

/**
 * The homepage ROI calculator's note, assembled.
 *
 * Marketing has five locales but HomeClient folds them to two bases via
 * baseOf() (fr* -> fr, everything else -> en), so this object has two keys and
 * matches what that file can actually render. Adding a third here without
 * touching baseOf() would produce unreachable copy.
 */
export const ROI_CALCULATOR_NOTE = {
  en: `Estimate assumes ~35% of local purchase decisions now touch an AI answer, 30% close rate on AI-referred leads. ${ESTIMATE_DISCLAIMER.en}`,
  fr: `L'estimation suppose qu'environ 35 % des décisions d'achat locales passent par une réponse d'IA, avec un taux de conversion de 30 % sur les prospects référés. ${ESTIMATE_DISCLAIMER.fr}`,
} as const;

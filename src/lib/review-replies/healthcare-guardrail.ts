// src/lib/review-replies/healthcare-guardrail.ts
//
// The healthcare reply guardrail (2026-11-09). For a practice, a public reply
// that confirms someone is a patient, or repeats anything about their care, can
// be a privacy breach — even a warm thank-you. So for tenants in a healthcare
// category, EVERY AI-drafted review reply:
//
//   - never confirms or denies that the reviewer is a patient;
//   - never mentions treatment, procedures, appointments, billing, or any
//     detail from the review that relates to their care;
//   - thanks them, acknowledges the feedback in general terms, and invites
//     them to contact the practice directly.
//
// TWO LAYERS, AND THE SECOND ONE IS THE GUARANTEE.
//   1. HEALTHCARE_REPLY_RULES joins the system prompt LAST, after the brand
//      voice guide, and says it overrides the voice guide and any tone.
//   2. enforceHealthcareReply() checks the draft deterministically and, on any
//      violation, replaces it with healthcareFallbackReply(). A model that
//      ignores layer 1 still cannot put a treatment detail into a draft.
//
// ALWAYS ON, NO SWITCH. Whether it applies is decided from the tenant's own
// category signals (isHealthcareCategory) — there is no setting a tenant can
// turn off, and the lookup fails CLOSED (tenant-category.ts).
//
// PURE — no Prisma, no fetch. Every path that drafts a reply imports this:
// /api/ai/respond (manual draft) and the Action Agent's review_reply generator
// (bulk batches, single regeneration, and the "Fix with AI" button, which
// enqueues that generator). There is no auto-reply path in this repo:
// ExternalReview.replyContent has no writer. A new drafting path must call
// enforceHealthcareReply too; tests/healthcare-reply-guardrail.test.ts lists
// the paths it checks.

import type { DashLocale } from "@/lib/i18n/dashboard";

/** Stored on drafts and folded into cache keys, so a rules change is a new key. */
export const HEALTHCARE_GUARDRAIL = "healthcare-v1" as const;

/** Lowercase, accents stripped ("médical" -> "medical", "Füllung" -> "fullung"). */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// ─── Which tenants ──────────────────────────────────────────────────────────

/**
 * Dental, medical and clinical categories, in en / fr / de, matched against
 * accent-stripped lowercase text. Deliberately broad: a false positive costs a
 * more generic reply, a false negative can cost a patient's privacy.
 */
const HEALTHCARE_CATEGORY: RegExp[] = [
  /\bdent(al|ists?|istry|aire|istes?|isterie)\b/,
  /\b(ortho|perio|endo)dont/,
  /\boral (and maxillofacial )?surg/,
  /\bimplantolog/,
  /zahn(arzt|arzte|klinik|medizin|praxis)/,
  /arzt|\barztin\b|\bmedizin/,
  /\bmedic(al|ine|aux|ale|o)?\b|\bmedecin/,
  /\bclinic(s|al)?\b|\bclinique|\bklinik/,
  /\bhealth ?care\b|\bhealth (clinic|centre|center|practice|services?)\b|\bmental health\b/,
  /\bsante\b/,
  /\bhospital|\bhopital|\bspital\b/,
  /\bphysicians?\b|\bdoctors?\b|\bdocteur/,
  /\bpatients?\b/,
  /\bchiropract|\bphysio|\bphysical therap|\bkine(si)?\b|\bkinesitherap|\bosteopath/,
  /\bpodiatr|\bpodolog|\bdermatolog|\bp(a)?ediatr|\boptometr|\bophthalm|\baudiolog/,
  /\bobstetric|\bgyn(a)?ecolog|\bcardiolog|\boncolog|\bradiolog|\burolog|\bneurolog|\borthop(a)?ed/,
  /\bpsychiatr|\bpsycholog|\bpsychotherap|\btherapists?\b/,
  /\bnurs(e|es|ing)\b|\burgent care\b|\bmed ?spa\b|\bpharmac|\bapotheke|\bdialysis|\bfertility|\bivf\b/,
  /\bhygienists?\b|\bdentures?\b/,
];

/** True when any of the given signals names a healthcare category. */
export function isHealthcareCategory(...signals: ReadonlyArray<string | null | undefined>): boolean {
  return signals.some((s) => {
    if (!s) return false;
    const t = norm(s);
    return HEALTHCARE_CATEGORY.some((re) => re.test(t));
  });
}

// ─── Layer 1: the prompt ────────────────────────────────────────────────────

/** Joins the system prompt AFTER the base instruction and the voice guide. */
export const HEALTHCARE_REPLY_RULES =
  "This business is a healthcare practice. The following rules override every other instruction, " +
  "including the brand voice and any requested tone:\n" +
  "- Never confirm or deny that the reviewer is or was a patient, or that they visited, were seen or were treated. " +
  'Do not use the words "patient", "visit", "appointment", "treatment", "care you received" or "your experience".\n' +
  "- Never mention any treatment, procedure, appointment, diagnosis, medication, test, wait time, billing, insurance, " +
  "payment, price, staff member, name, date or any other detail from the review, even to agree with it or correct it. " +
  "Do not quote or paraphrase the review.\n" +
  "- Do only this: thank them for the feedback, acknowledge it in general terms (for critical feedback, say you take " +
  "every comment seriously), and invite them to contact the practice directly. 2 to 4 short sentences.";

// ─── Layer 2: the check ─────────────────────────────────────────────────────

export type HealthcareViolationRule = "relationship" | "care_detail" | "review_detail";

export interface HealthcareViolation {
  rule: HealthcareViolationRule;
  match: string;
}

/** Wording that confirms or denies a care relationship. */
const RELATIONSHIP: RegExp[] = [
  /\bpatient(e|es|s|in|innen|en)?\b/,
  /\byour (visit|visits|appointment|appointments|treatment|treatments|procedure|procedures|care|experience|stay|session|consultation|exam|examination|check-?up|cleaning|surgery|dentist|doctor|hygienist|provider|therapist|records?|file|chart|bill|invoice|insurance|results?|diagnosis|prescription|medication|time with us|time here)\b/,
  /\b(you|you've|you have|you had) (visited|came in|come in|were seen|were treated|were here|been here|been in|been seen|been treated)\b/,
  /\bwhen you (came|were|visited)\b|\bduring your\b|\bsince your\b|\bafter your\b/,
  /\b(we|i) (treated|saw|examined|have seen|have treated)\b/,
  /\bour (records|files|system|charts?)\b|\bno record\b|\bon file\b/,
  /\bwelcome back\b|\bsee you (again|next|soon)\b|\bnext (visit|appointment|time you)\b|\bcome back\b|\breturn visit\b/,
  /\b(votre|vos) (visite|visites|rendez-vous|rdv|traitements?|soins?|interventions?|consultations?|examens?|seances?|sejour|dossiers?|factures?|assurance|dentiste|medecin|hygieniste|experience|passage|resultats)\b/,
  /\blors de votre\b|\bvous revoir\b|\bnos dossiers\b|\bnos fichiers\b/,
  /\b(ihr|ihre|ihren|ihrem|ihrer) (besuch|termin|behandlung|untersuchung|aufenthalt|rechnung|versicherung|zahnarzt|arzt|arztin|akte|erfahrung|eingriff)\w*\b/,
  /\bwiedersehen\b|\bunsere(n)? (akten|unterlagen|kartei)\b/,
];

/** Care, treatment, appointment and billing vocabulary: never in a reply. */
const CARE_DETAIL: RegExp[] = [
  // en
  /\btreat(ment|ments|ed|ing)?\b|\bprocedures?\b|\bappointments?\b|\bsurg(ery|eries|ical|eon|eons)\b|\boperation\b/,
  /\bdiagnos\w*|\bprescri\w*|\bmedications?\b|\bmedicines?\b|\bdosage\b|\bx-?rays?\b|\bbiops\w*|\blab results?\b|\btest results?\b/,
  /\bbill(s|ed|ing)?\b|\binvoic\w*|\binsurance\b|\bco-?pay\w*|\bdeductibles?\b|\bpayments?\b|\brefund\w*|\bcharg(e|es|ed|ing)\b|\bfees?\b|\bprices?\b|\bcosts?\b/,
  /\bfillings?\b|\bcrowns?\b|\bimplants?\b|\broot canals?\b|\bextract(ion|ions|ed)\b|\bcleanings?\b|\bwhitening\b|\bbraces\b|\baligners?\b|\binvisalign\b|\bveneers?\b|\bdentures?\b|\bcavit(y|ies)\b|\bgums?\b|\btooth\b|\bteeth\b|\bmolars?\b|\bwisdom\b/,
  /\ban(a)?esthe\w*|\bnumb\w*|\binjections?\b|\bvaccin\w*|\bblood\b|\btherap(y|ies)\b|\bexam(s|ination|inations)?\b|\bcheck-?ups?\b|\bconsultations?\b/,
  /\bwait(ed|ing)?\b|\bwait times?\b|\bwaiting room\b|\bpain(ful|less)?\b|\bhurt\w*/,
  /\bdentists?\b|\bdoctors?\b|\bdr\b|\bnurses?\b|\bhygienists?\b|\bphysicians?\b|\btherapists?\b|\bsurgeons?\b|\breceptionists?\b/,
  /\bquality of care\b|\bcare (you|that you)\b/,
  // fr
  /\btraitements?\b|\bsoins?\b|\binterventions?\b|\bchirurgi\w*|\brendez-vous\b|\brdv\b|\bdiagnostic\w*|\bordonnances?\b|\bmedicaments?\b/,
  /\bfactur\w*|\bmutuelle\b|\bremboursement\w*|\bpaiements?\b|\btarifs?\b|\bprix\b|\bhonoraires\b/,
  /\bcouronnes?\b|\bplombages?\b|\bcaries?\b|\bdetartrage\b|\bblanchiment\b|\bgouttieres?\b|\bdents?\b|\bgencives?\b|\banesthesi\w*|\bpiqures?\b|\bradio(graphie)?s?\b|\bexamens?\b|\battente\b|\bdouleurs?\b/,
  /\bdentistes?\b|\bmedecins?\b|\bdocteurs?\b|\bhygienistes?\b|\binfirmi(er|ere|ers|eres)\b/,
  // de
  /\bbehandlung\w*|\beingriff\w*|\btermin(e|en)?\b|\bdiagnose\w*|\brezept\w*|\bmedikament\w*/,
  /\brechnung\w*|\bversicherung\w*|\bkrankenkasse\w*|\bzahlung\w*|\bkosten\b|\bpreis\w*/,
  /\bkronen?\b|\bimplantat\w*|\bfullung\w*|\bkaries\b|\bzahn\w*|\bzahne\w*|\bbetaubung\w*|\bspritze\w*|\brontgen\w*|\buntersuchung\w*|\bwartezeit\w*|\bwartezimmer\b|\bschmerz\w*|\barzt\w*/,
];

/** Words a general reply needs; sharing them with the review repeats nothing. */
const GENERIC_REPLY_WORDS = new Set(
  (
    "thank thanks thankful taking time share sharing shared feedback review reviews comment comments words kind kindly " +
    "appreciate appreciated appreciation sorry hear hearing contact office practice team directly please reach call " +
    "email message seriously serious concerns concern welcome chance discuss talk speak listen happy glad value valued " +
    "every everyone always would like love know further anything questions question help hope best wishes regards " +
    "great good wonderful positive critical honest note noted look forward hearing soon possible convenience take " +
    "merci remercions pris temps votre retour retours commentaire commentaires message avis appreciation apprecions " +
    "contacter directement cabinet equipe serieux prenons chaque heureux heureuse discuter echanger hesitez question " +
    "questions laisser notre serions " +
    "vielen dank danke ihre ihr feedback ruckmeldung zeit worte freundlichen schatzen nehmen ernst gerne " +
    "sprechen bitte wenden direkt unsere praxis fragen dass sich genommen jede wurden ihnen daruber"
  ).split(" "),
);

/** Common function words in en / fr / de, never "details". */
const STOPWORDS = new Set(
  (
    "the a an and or but if so to of in on at for with from by as is are was were be been being it its this that these " +
    "those we our ours us you your yours i me my he she they them their there here what which who whom when where why how " +
    "not no yes all any some more most very really just also too than then about into over after before again only own " +
    "same can could will would should may might must do does did done have has had having get got " +
    "le la les un une des et ou mais de du au aux en dans sur pour par avec sans ce cette ces nous vous je il elle ils " +
    "elles est sont etait ete etre avoir a ai ont tres plus moins pas ne que qui quoi dont tout tous toute toutes " +
    "der die das ein eine einen einem einer und oder aber zu von mit fur auf aus bei nach ist sind war waren sein haben " +
    "hat wir sie ich er es nicht kein keine sehr auch noch nur wie was wer wo"
  ).split(" "),
);

function words(text: string): string[] {
  return norm(text).match(/[a-z0-9]+/g) ?? [];
}

/**
 * Names in the review: a capitalised word that does not start a sentence, plus
 * any word after a title (Dr, Dr., Doctor, Docteur). Business-name words and
 * the pronoun "I" excluded.
 */
function namesIn(review: string, businessWords: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  const re = /(^|[.!?]\s+|\s)([A-ZÀ-ÖØ-Þ][\p{L}'-]{2,})/gu;
  for (const m of review.matchAll(re)) {
    const sentenceStart = m[1] === "" || /[.!?]/.test(m[1]);
    const w = norm(m[2]);
    if (!sentenceStart && !businessWords.has(w) && !STOPWORDS.has(w) && !GENERIC_REPLY_WORDS.has(w)) out.add(w);
  }
  for (const m of review.matchAll(/\b(?:dr\.?|doctor|docteur|doktor)\s+([\p{L}'-]{2,})/giu)) out.add(norm(m[1]));
  return out;
}

export interface HealthcareReplyContext {
  /** The review being answered. */
  reviewText: string;
  /** Its occurrences are removed before checking: "Smile Dental Clinic" is not a care detail. */
  businessName?: string | null;
}

/** Every way `reply` breaks the guardrail. Empty means it may be shown as drafted. */
export function healthcareReplyViolations(reply: string, ctx: HealthcareReplyContext): HealthcareViolation[] {
  const business = (ctx.businessName ?? "").trim();
  const businessWords = new Set(words(business));
  // Strip the business's own name, case-insensitively, before any check.
  let text = reply;
  if (business) text = text.split(new RegExp(business.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join(" ");
  const t = norm(text);
  const out: HealthcareViolation[] = [];

  for (const re of RELATIONSHIP) {
    const m = t.match(re);
    if (m) out.push({ rule: "relationship", match: m[0] });
  }
  for (const re of CARE_DETAIL) {
    const m = t.match(re);
    if (m) out.push({ rule: "care_detail", match: m[0] });
  }

  // Anything specific the reviewer wrote, repeated back: a shared content word
  // that is not part of a general reply's vocabulary, or a name.
  const replyWords = new Set(words(text));
  const reviewWords = new Set(words(ctx.reviewText));
  for (const w of reviewWords) {
    if (w.length < 4 || STOPWORDS.has(w) || GENERIC_REPLY_WORDS.has(w) || businessWords.has(w) || /^\d+$/.test(w)) continue;
    if (replyWords.has(w)) out.push({ rule: "review_detail", match: w });
  }
  for (const name of namesIn(ctx.reviewText, businessWords)) {
    if (replyWords.has(name) && !out.some((v) => v.match === name)) out.push({ rule: "review_detail", match: name });
  }
  return out;
}

// ─── The fallback ───────────────────────────────────────────────────────────

/**
 * The reply used when a draft breaks the guardrail. Says nothing about the
 * reviewer or the review beyond its tone, which a 1-5 rating already makes
 * public. de-CH uses ss, never ß.
 */
export function healthcareFallbackReply(input: { rating: number | null; locale: DashLocale }): string {
  const positive = typeof input.rating === "number" && input.rating >= 4;
  switch (input.locale) {
    case "fr":
      return positive
        ? "Merci d'avoir pris le temps de nous laisser ce message. Nous apprécions votre retour. Pour toute question, n'hésitez pas à contacter directement notre cabinet."
        : "Merci pour votre retour. Nous prenons chaque commentaire au sérieux et serions heureux d'en discuter avec vous. N'hésitez pas à contacter directement notre cabinet.";
    case "de-CH":
      return positive
        ? "Vielen Dank, dass Sie sich die Zeit für Ihre freundlichen Worte genommen haben. Wir schätzen Ihr Feedback. Bei Fragen wenden Sie sich bitte direkt an unsere Praxis."
        : "Vielen Dank für Ihr Feedback. Wir nehmen jede Rückmeldung ernst und würden gerne mit Ihnen darüber sprechen. Bitte wenden Sie sich direkt an unsere Praxis.";
    default:
      return positive
        ? "Thank you for taking the time to share your kind words. We appreciate your feedback. If there is anything you would like to discuss, please contact our office directly."
        : "Thank you for your feedback. We take every comment seriously and would welcome the chance to talk with you. Please contact our office directly.";
  }
}

export interface EnforcedReply {
  reply: string;
  /** What the model's draft broke; empty when it passed as written. */
  violations: HealthcareViolation[];
  /** True when the draft was replaced by the fallback. */
  replaced: boolean;
}

/** Check a drafted reply; replace it with the fallback on any violation (or when empty). */
export function enforceHealthcareReply(
  draft: string,
  ctx: HealthcareReplyContext & { rating: number | null; locale: DashLocale },
): EnforcedReply {
  const reply = draft.trim();
  const violations = reply ? healthcareReplyViolations(reply, ctx) : [{ rule: "review_detail" as const, match: "" }];
  if (violations.length === 0) return { reply, violations, replaced: false };
  return { reply: healthcareFallbackReply(ctx), violations, replaced: true };
}

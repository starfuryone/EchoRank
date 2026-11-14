// src/lib/onboarding-email-render.ts — the onboarding drip's emails, rendered
// in the repo (2026-11-14).
//
// They used to be Brevo templates referenced by ID (BREVO_ONBOARDING_*_ID),
// which were never uploaded, so nothing could ever render. Now the sender
// (src/lib/onboarding-email.ts) posts this HTML as `htmlContent` to the same
// transactional endpoint, and nothing depends on a template stored in Brevo.
//
// SERVICE EMAIL, NOT MARKETING (2026-11-14): every new account gets it,
// whatever its marketing consent. So the copy is about using the product and
// the account, with no promotion: no upgrade pitch, no offer. Each email keeps
// its own unsubscribe link.
//
// A PURE RENDER, like src/lib/billing/trial-ending-email.ts: no Prisma, no
// queue, so tests (and a smoke script) render a real message without either.
//
// Every email carries: the ECHORANK™ wordmark, its stage's own call to action,
// a "See your plan" button (planUrl, or https://echorank360.com/plan), "Cancel
// anytime", and the footer (why you get it, unsubscribe, privacy and terms,
// the company line from src/lib/brand/company.ts). Every value from the
// database is escaped; every number renders only behind its has* flag, so no
// invented figure is ever sent.

import { COMPANY_EMAIL_LINE } from "@/lib/brand/company";
import { HOME_PRICING_CHROME } from "@/lib/i18n/content";
import { SITE_URL } from "@/lib/seo/constants";

export type OnboardingStage = "d0" | "d2" | "d5" | "d10";
export type OnboardingLocale = "en" | "fr";

/** Where "See your plan" goes when the params carry no usable planUrl. */
export const PLAN_URL_FALLBACK = "https://echorank360.com/plan";

/** The params the sender builds (src/lib/onboarding-email.ts). */
export interface OnboardingParams {
  firstName: string;
  brand: string;
  hasScore: boolean;
  score: number | null;
  grade: string | null;
  topFixTitle: string | null;
  topFixAction: string | null;
  visibilityUrl: string;
  dashboardUrl: string;
  planUrl?: string | null;
  unsubscribeUrl?: string | null;
  // d2
  hasDoneCount?: boolean;
  doneCount?: number;
  totalCount?: number;
  nextStepLabel?: string | null;
  nextStepUrl?: string;
  // d5
  hasCompetitors?: boolean;
  competitorNames?: string;
  /** The plan includes competitor intelligence (/intelligence). */
  isGrowthPlus?: boolean;
  ctaUrl?: string;
  // d10
  planName?: string;
  billingUrl?: string;
}

export interface RenderedOnboardingEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Only absolute http(s) links reach an href. */
const safeUrl = (u: unknown, fallback: string) =>
  typeof u === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : fallback;

export function planUrlOf(p: Pick<OnboardingParams, "planUrl">): string {
  return safeUrl(p.planUrl, PLAN_URL_FALLBACK);
}

// ── Copy ────────────────────────────────────────────────────────────────────
// Brand is Echorank (never camel-case); plan names come in as values.

interface Copy {
  hi: (name: string) => string;
  subject: Record<OnboardingStage, string>;
  // d0
  d0Score: (brand: string) => string;
  scoreLabel: (grade: string) => string;
  topFix: string;
  d0NoScore: (brand: string) => string;
  seeResults: string;
  runFirstAudit: string;
  // d2
  d2Intro: string;
  d2Progress: (done: number, total: number) => string;
  doItNow: string;
  openDashboard: string;
  // d5
  d5Title: string;
  d5Competitors: (brand: string, names: string) => string;
  d5NoCompetitors: (brand: string) => string;
  d5Included: string;
  d5Compare: string;
  d5SeeAnswers: string;
  // d10
  d10Intro: (brand: string) => string;
  d10Progress: (done: number, total: number) => string;
  d10Score: (score: number, grade: string) => string;
  d10Plan: (plan: string) => string;
  d10Pdf: string;
  // every email
  seePlan: string;
  footerWhy: string;
  unsubscribe: string;
  privacy: string;
  terms: string;
}

const COPY: Record<OnboardingLocale, Copy> = {
  en: {
    hi: (n) => `Hi ${n},`,
    subject: {
      d0: "Your first AI Visibility results",
      d2: "One step to get more from Echorank",
      d5: "Who AI recommends instead of you",
      d10: "What you have set up in Echorank so far",
    },
    d0Score: (b) => `Here is where <strong>${b}</strong> stands with AI answer engines today:`,
    scoreLabel: (g) => `AI Visibility score — grade ${g}`,
    topFix: "Your #1 recommended fix:",
    d0NoScore: (b) =>
      `Your workspace for <strong>${b}</strong> is ready. Run your first AI Visibility audit to see how your business appears in AI answers. It takes under a minute.`,
    seeResults: "See your full results",
    runFirstAudit: "Run my first audit",
    d2Intro: "One small step will get you the most value from Echorank right now:",
    d2Progress: (d, t) => `You have done ${d} of ${t} setup steps.`,
    doItNow: "Do it now",
    openDashboard: "Open your dashboard",
    d5Title: "When AI answers, who gets recommended?",
    d5Competitors: (b, n) =>
      `In recent AI answers relevant to <strong>${b}</strong>, these competitors were mentioned: <strong>${n}</strong>.`,
    d5NoCompetitors: (b) =>
      `When someone asks ChatGPT, Claude or Perplexity for a business like <strong>${b}</strong>, the engines pick who to recommend, and who to leave out.`,
    d5Included: "Your plan includes competitor intelligence: see how you compare, side by side.",
    d5Compare: "Compare with competitors",
    d5SeeAnswers: "See your AI Visibility results",
    d10Intro: (b) => `Here is what <strong>${b}</strong> has set up in Echorank so far.`,
    d10Progress: (d, t) => `Setup: ${d} of ${t} steps done.`,
    d10Score: (s, g) => `AI Visibility score: ${s}/100, grade ${g}.`,
    d10Plan: (p) => `Your ${p} plan carries on after the trial. You can change or cancel it from Billing.`,
    d10Pdf: "Download my PDF report",
    seePlan: "See your plan",
    footerWhy: "You are receiving this because you created an Echorank account.",
    unsubscribe: "Unsubscribe",
    privacy: "Privacy",
    terms: "Terms",
  },
  fr: {
    hi: (n) => `Bonjour ${n},`,
    subject: {
      d0: "Vos premiers résultats de visibilité IA",
      d2: "Une étape pour tirer plus d'Echorank",
      d5: "Qui l'IA recommande à votre place",
      d10: "Ce que vous avez mis en place dans Echorank",
    },
    d0Score: (b) => `Voici où se situe <strong>${b}</strong> auprès des moteurs de réponse IA aujourd'hui :`,
    scoreLabel: (g) => `Score de visibilité IA — note ${g}`,
    topFix: "Votre correctif recommandé n° 1 :",
    d0NoScore: (b) =>
      `Votre espace pour <strong>${b}</strong> est prêt. Lancez votre premier audit de visibilité IA pour voir comment votre entreprise apparaît dans les réponses des IA. Cela prend moins d'une minute.`,
    seeResults: "Voir vos résultats complets",
    runFirstAudit: "Lancer mon premier audit",
    d2Intro: "Une petite étape vous donnera le maximum de valeur dès maintenant :",
    d2Progress: (d, t) => `Vous avez terminé ${d} étapes de configuration sur ${t}.`,
    doItNow: "Le faire maintenant",
    openDashboard: "Ouvrir votre tableau de bord",
    d5Title: "Quand l'IA répond, qui est recommandé?",
    d5Competitors: (b, n) =>
      `Dans les réponses récentes des IA pertinentes pour <strong>${b}</strong>, ces concurrents ont été mentionnés : <strong>${n}</strong>.`,
    d5NoCompetitors: (b) =>
      `Quand quelqu'un demande à ChatGPT, Claude ou Perplexity une entreprise comme <strong>${b}</strong>, les moteurs choisissent qui recommander, et qui laisser de côté.`,
    d5Included: "Votre forfait inclut l'intelligence concurrentielle : voyez comment vous vous comparez, côte à côte.",
    d5Compare: "Comparer avec les concurrents",
    d5SeeAnswers: "Voir vos résultats de visibilité IA",
    d10Intro: (b) => `Voici ce que <strong>${b}</strong> a mis en place dans Echorank jusqu'ici.`,
    d10Progress: (d, t) => `Configuration : ${d} étapes sur ${t} terminées.`,
    d10Score: (s, g) => `Score de visibilité IA : ${s}/100, note ${g}.`,
    d10Plan: (p) =>
      `Votre forfait ${p} se poursuit après l'essai. Vous pouvez le modifier ou l'annuler depuis la page Facturation.`,
    d10Pdf: "Télécharger mon rapport PDF",
    seePlan: "Voir votre forfait",
    footerWhy: "Vous recevez ce message parce que vous avez créé un compte Echorank.",
    unsubscribe: "Se désabonner",
    privacy: "Confidentialité",
    terms: "Conditions",
  },
};

// ── Building blocks ─────────────────────────────────────────────────────────

const P = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;";

/** The ECHORANK™ wordmark (diamond + ECHORANK + ™) as HTML text on the dark band:
 *  no image to block, and Gmail does not display SVG. */
const HEADER =
  `<tr><td style="background:#181A20;padding:20px 32px;">` +
  `<span style="color:#d4a843;font-size:18px;line-height:1;">&#9670;</span>` +
  `<span style="color:#ffffff;font-size:16px;font-weight:bold;letter-spacing:4px;margin-left:8px;">ECHORANK</span>` +
  `<sup style="color:#ffffff;font-size:9px;margin-left:1px;">&trade;</sup>` +
  `</td></tr>`;

const button = (href: string, label: string, primary = true) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td style="border-radius:8px;${
    primary ? "background:#2563eb;" : "border:1px solid #2563eb;"
  }">` +
  `<a href="${esc(href)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:bold;text-decoration:none;color:${
    primary ? "#ffffff" : "#2563eb"
  };">${esc(label)}</a></td></tr></table>`;

interface Body {
  html: string[];
  text: string[];
  cta: { href: string; label: string } | null;
}

/** HTML with <strong> only (the copy's own markup) → plain text. */
const plain = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function stageBody(stage: OnboardingStage, c: Copy, p: OnboardingParams): Body {
  const brand = esc(p.brand);
  const html: string[] = [];
  const text: string[] = [];
  const say = (s: string) => {
    html.push(`<p style="${P}">${s}</p>`);
    text.push(plain(s));
  };
  const visibilityUrl = safeUrl(p.visibilityUrl, `${SITE_URL}/visibility`);
  const scored = p.hasScore && typeof p.score === "number";

  if (stage === "d0") {
    if (scored) {
      say(c.d0Score(brand));
      html.push(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td style="background:#eff6ff;border-radius:10px;padding:16px 24px;text-align:center;">` +
          `<div style="font-size:32px;font-weight:bold;color:#2563eb;">${esc(p.score)}/100</div>` +
          `<div style="font-size:13px;color:#6b7280;">${esc(c.scoreLabel(p.grade ?? "—"))}</div></td></tr></table>`,
      );
      text.push(`${p.score}/100 · ${c.scoreLabel(p.grade ?? "—")}`);
      if (p.topFixTitle) {
        say(`<strong>${esc(c.topFix)}</strong> ${esc(p.topFixTitle)}`);
        if (p.topFixAction) say(esc(p.topFixAction));
      }
    } else {
      say(c.d0NoScore(brand));
    }
    return { html, text, cta: { href: visibilityUrl, label: scored ? c.seeResults : c.runFirstAudit } };
  }

  if (stage === "d2") {
    say(esc(c.d2Intro));
    if (p.hasDoneCount && typeof p.doneCount === "number" && typeof p.totalCount === "number") {
      say(esc(c.d2Progress(p.doneCount, p.totalCount)));
    }
    if (p.nextStepLabel) {
      html.push(
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;"><tr><td style="background:#eff6ff;border-left:4px solid #2563eb;border-radius:8px;padding:16px 20px;">` +
          `<span style="font-size:16px;font-weight:bold;color:#111827;">${esc(p.nextStepLabel)}</span></td></tr></table>`,
      );
      text.push(`→ ${p.nextStepLabel}`);
      return { html, text, cta: { href: safeUrl(p.nextStepUrl, `${SITE_URL}/dashboard`), label: c.doItNow } };
    }
    return { html, text, cta: { href: safeUrl(p.dashboardUrl, `${SITE_URL}/dashboard`), label: c.openDashboard } };
  }

  if (stage === "d5") {
    html.push(`<h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${esc(c.d5Title)}</h2>`);
    text.push(c.d5Title);
    say(p.hasCompetitors && p.competitorNames ? c.d5Competitors(brand, esc(p.competitorNames)) : c.d5NoCompetitors(brand));
    if (p.isGrowthPlus) {
      say(esc(c.d5Included));
      return { html, text, cta: { href: safeUrl(p.ctaUrl, visibilityUrl), label: c.d5Compare } };
    }
    // A plan without competitor intelligence gets its own results, never an
    // upgrade pitch: this is a service email.
    return { html, text, cta: { href: visibilityUrl, label: c.d5SeeAnswers } };
  }

  // d10: a value recap, never a date (tests/onboarding-d10-framing.test.ts).
  say(c.d10Intro(brand));
  if (p.hasDoneCount && typeof p.doneCount === "number" && typeof p.totalCount === "number") {
    say(esc(c.d10Progress(p.doneCount, p.totalCount)));
  }
  if (scored) say(esc(c.d10Score(p.score!, p.grade ?? "—")));
  if (p.planName) say(esc(c.d10Plan(p.planName)));
  return { html, text, cta: { href: visibilityUrl, label: scored ? c.d10Pdf : c.runFirstAudit } };
}

export function renderOnboardingEmail(
  stage: OnboardingStage,
  locale: OnboardingLocale,
  p: OnboardingParams,
): RenderedOnboardingEmail {
  const c = COPY[locale];
  const body = stageBody(stage, c, p);
  const planUrl = planUrlOf(p);
  const cancel = HOME_PRICING_CHROME[locale].cancelAnytime;
  const unsub = typeof p.unsubscribeUrl === "string" ? safeUrl(p.unsubscribeUrl, "") : "";
  const legal = (doc: "privacy" | "terms") => `${SITE_URL}/${locale}/legal/${doc}`;
  const link = (href: string, label: string) => `<a href="${esc(href)}" style="color:#6b7280;">${esc(label)}</a>`;

  const html =
    `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(c.subject[stage])}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">` +
    HEADER +
    `<tr><td style="padding:32px;">` +
    `<h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${esc(c.hi(p.firstName))}</h1>` +
    body.html.join("") +
    (body.cta ? button(body.cta.href, body.cta.label) : "") +
    button(planUrl, c.seePlan, false) +
    `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${esc(cancel)}</p>` +
    `</td></tr>` +
    `<tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#6b7280;">` +
    `<p style="margin:0 0 8px;">${esc(c.footerWhy)}${unsub ? ` ${link(unsub, c.unsubscribe)}` : ""}</p>` +
    `<p style="margin:0 0 8px;">${link(legal("privacy"), c.privacy)} · ${link(legal("terms"), c.terms)}</p>` +
    `<p style="margin:0;">${esc(COMPANY_EMAIL_LINE)}</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const text = [
    c.hi(p.firstName),
    "",
    ...body.text,
    "",
    ...(body.cta ? [`${body.cta.label}: ${body.cta.href}`] : []),
    `${c.seePlan}: ${planUrl}`,
    cancel,
    "",
    "--",
    c.footerWhy,
    ...(unsub ? [`${c.unsubscribe}: ${unsub}`] : []),
    `${c.privacy}: ${legal("privacy")}`,
    `${c.terms}: ${legal("terms")}`,
    COMPANY_EMAIL_LINE,
  ].join("\n");

  return { subject: c.subject[stage], html, text };
}

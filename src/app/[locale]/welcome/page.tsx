// Post-checkout landing page. Stripe's success_url points here.
//
// TWO CONTRACTS NOW, AND metadata.flow ON THE SESSION IS WHAT PICKS BETWEEN
// THEM. Both are live; neither may leak into the other.
//
// flow=upgrade (and anything without a flow) — THE PAGE CONFIRMS, IT DOES NOT
// ENTITLE, exactly as before. The session id is a display hint and nothing
// more: it is user-supplied, a visitor could paste anyone's, and plan access
// comes from the webhook writing the Subscription row. Nothing on this path
// reads or changes account state. Unchanged, deliberately — a signed-in
// customer's confirmation page is not part of the inversion.
//
// flow=guest_signup — the session id is a CREDENTIAL, because it is the only
// thing the buyer has: there is no account to log into yet. It authorises
// setting the first password, once. Every rule that makes that safe lives in
// src/lib/billing/guest-welcome.ts; this file only renders what it returns.
//
// IT MUST NEVER THROW, ON EITHER PATH. A missing, malformed, expired or foreign
// session id all fall back to the generic welcome — someone who has just paid
// should not meet an error page because a query string was mangled in an email
// client. That is also why every guest reject renders the same generic state
// rather than four different ones: the page cannot tell them apart, and the
// endpoint that matters refuses all four identically.
//
// LOCALE MODEL: en/fr bases like the rest of the marketing tree (en-CA folds to
// en, fr-CA to fr, de-CH shows English). Dates and money are formatted with the
// real five-locale tag, so a de-CH visitor still gets Swiss date and currency
// conventions even though the prose is English.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type Stripe from "stripe";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { getStripe } from "@/lib/stripe/client";
import { PLAN_CONFIGS, PLAN_ORDER, TRIAL_DAYS } from "@/lib/plan-config";
import { PLAN_HOME } from "@/lib/plan-routing";
import { logger } from "@/infrastructure/observability/logger";
import { resolveGuestSession } from "@/lib/billing/guest-welcome";
import { GuestSetup } from "./GuestSetup";
import { PublicNav } from "../PublicNav";
import s from "../home2.module.css";
import g from "../guides/_shared/guide.module.css";

const log = logger.child({ module: "welcome" });

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : "en");

const COPY = {
  en: {
    eyebrow: "WELCOME",
    title: "You're in.",
    generic:
      "Your account is ready. If you have just started a trial, it can take a few seconds for the confirmation to arrive — your plan will be up to date on the billing page shortly.",
    confirmed: (plan: string) => `Your ${plan} trial has started.`,
    trialUntil: "Free until",
    thenCharged: "Then",
    autoCharge:
      "The card you entered is charged automatically when the trial ends, unless you cancel before then. You can cancel any time from the billing page.",
    noAmount:
      "The card you entered is charged automatically when the trial ends, unless you cancel before then.",
    trialLen: (n: number) => `${n}-day free trial`,
    ctaApp: "Go to your dashboard",
    ctaBilling: "Manage billing",
    pending:
      "Still setting up? Access can take a moment to appear while the confirmation from Stripe lands.",
    guest: {
      readyTitle: "One last step: choose a password.",
      readyBody: (email: string) =>
        email
          ? `Your account is set up under ${email}. Choose a password and you are straight in.`
          : "Your account is set up. Choose a password and you are straight in.",
      passwordLabel: "Password",
      passwordHint: "At least 8 characters.",
      submit: "Set password and continue",
      submitBusy: "Setting up…",
      errShort: "Please use at least 8 characters.",
      errFailed: "That link can no longer be used. If you have already set a password, log in instead.",
      errSignin: "Your password is set. Please log in to continue.",
      pendingTitle: "Setting up your account…",
      pendingBody:
        "Your payment went through. We are waiting on the confirmation from Stripe — this page updates itself, so there is nothing to do.",
      pendingSlow:
        "This is taking longer than usual. Your payment went through and your account will be ready shortly — try this link again in a few minutes, or contact us and we will finish it by hand.",
      consumedTitle: "This account is already set up.",
      consumedBody:
        "A password has already been chosen for it. Log in and you are away — use the password reset on the login page if you cannot remember it.",
      loginCta: "Log in",
    },
  },
  fr: {
    eyebrow: "BIENVENUE",
    title: "C'est parti.",
    generic:
      "Votre compte est prêt. Si vous venez de démarrer un essai, la confirmation peut mettre quelques secondes à arriver — votre forfait sera à jour sur la page de facturation sous peu.",
    confirmed: (plan: string) => `Votre essai ${plan} a démarré.`,
    trialUntil: "Gratuit jusqu'au",
    thenCharged: "Ensuite",
    autoCharge:
      "La carte saisie est débitée automatiquement à la fin de l'essai, sauf annulation avant cette date. Vous pouvez annuler à tout moment depuis la page de facturation.",
    noAmount:
      "La carte saisie est débitée automatiquement à la fin de l'essai, sauf annulation avant cette date.",
    trialLen: (n: number) => `Essai gratuit de ${n} jours`,
    ctaApp: "Aller au tableau de bord",
    ctaBilling: "Gérer la facturation",
    pending:
      "Configuration en cours ? L'accès peut mettre un instant à apparaître, le temps que la confirmation de Stripe arrive.",
    guest: {
      readyTitle: "Dernière étape : choisissez un mot de passe.",
      readyBody: (email: string) =>
        email
          ? `Votre compte est créé au nom de ${email}. Choisissez un mot de passe et vous y êtes.`
          : "Votre compte est créé. Choisissez un mot de passe et vous y êtes.",
      passwordLabel: "Mot de passe",
      passwordHint: "8 caractères minimum.",
      submit: "Définir le mot de passe et continuer",
      submitBusy: "Configuration en cours…",
      errShort: "Veuillez utiliser au moins 8 caractères.",
      errFailed:
        "Ce lien n'est plus utilisable. Si vous avez déjà défini un mot de passe, connectez-vous.",
      errSignin: "Votre mot de passe est défini. Connectez-vous pour continuer.",
      pendingTitle: "Création de votre compte…",
      pendingBody:
        "Votre paiement est passé. Nous attendons la confirmation de Stripe — cette page se met à jour toute seule, vous n'avez rien à faire.",
      pendingSlow:
        "Cela prend plus de temps que d'habitude. Votre paiement est passé et votre compte sera prêt sous peu — réessayez ce lien dans quelques minutes, ou écrivez-nous et nous terminerons à la main.",
      consumedTitle: "Ce compte est déjà configuré.",
      consumedBody:
        "Un mot de passe a déjà été choisi. Connectez-vous — utilisez la réinitialisation sur la page de connexion si vous ne vous en souvenez plus.",
      loginCta: "Se connecter",
    },
  },
} as const;

const META = {
  en: { title: "Welcome to Echorank", description: "Your Echorank trial has started." },
  fr: { title: "Bienvenue sur Echorank", description: "Votre essai Echorank a démarré." },
};

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};
  const m = META[baseOf(locale)];
  return buildMetadata({
    locale: locale as Locale,
    path: "/welcome",
    title: m.title,
    description: m.description,
    // Nothing to index: the useful version of this page only exists with a
    // session id, and that is per-purchase.
    noIndex: true,
  });
}

interface Confirmation {
  planName: string;
  planHome: string;
  trialEnd: Date | null;
  amountMinor: number | null;
  currency: string | null;
  interval: string | null;
}

/**
 * Read the session for display. Any failure returns null and the page renders
 * its generic state — a bad id is a cosmetic problem, not an error condition.
 */
async function loadConfirmation(sessionId: string): Promise<Confirmation | null> {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.items.data.price"],
    });

    const sub = session.subscription;
    const subscription: Stripe.Subscription | null =
      sub && typeof sub !== "string" ? sub : null;

    // Prefer the tier we stamped at checkout; fall back to the price nickname
    // only for a plan name, never for entitlement.
    const tier = (session.metadata?.tier ?? subscription?.metadata?.tier ?? "").toUpperCase();
    const planType = PLAN_ORDER.find((p) => p === tier) ?? null;
    const planName = planType ? PLAN_CONFIGS[planType].name : "Echorank";
    const planHome = planType ? PLAN_HOME[planType] : "/dashboard";

    const item = subscription?.items?.data?.[0];
    const price = item?.price ?? null;

    return {
      planName,
      planHome,
      trialEnd: subscription?.trial_end ? new Date(subscription.trial_end * 1000) : null,
      amountMinor: price?.unit_amount ?? null,
      currency: price?.currency ?? null,
      interval: price?.recurring?.interval ?? null,
    };
  } catch (err) {
    // Expected for an expired, mistyped or foreign id.
    log.info({ err, sessionId }, "Could not load checkout session for welcome page");
    return null;
  }
}

export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ s?: string; session_id?: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  // `s` is the parameter this app's success_url has always used. `session_id`
  // is accepted alongside it because it is Stripe's own documented placeholder
  // name and is what a hand-built link or a pasted example will carry.
  const { s: sParam, session_id: sessionIdParam } = await searchParams;
  const sessionId = sParam ?? sessionIdParam;
  const c = COPY[baseOf(locale)];

  // THE GUEST BRANCH IS TRIED FIRST, AND ONLY A COMPLETE guest_signup SESSION
  // GETS PAST IT. Everything else — upgrade, credit, incomplete, garbage,
  // absent — falls through to the confirmation page below with its original
  // behaviour intact. resolveGuestSession collapses all four reject reasons to
  // `invalid`, so there is one fallthrough rather than four.
  const guest =
    sessionId && sessionId.startsWith("cs_") ? await resolveGuestSession(sessionId) : null;

  if (guest && guest.kind !== "invalid") {
    return (
      <div className={s.page}>
        <PublicNav locale={locale} />
        <section className={s.section}>
          <div className={`${s.container} ${g.article}`}>
            <p className={s.label}>
              <b>/ {c.eyebrow}</b>
            </p>
            <h1 className={s.h2}>{c.title}</h1>
            <GuestSetup
              sessionId={sessionId!}
              initialKind={guest.kind}
              email={guest.kind === "ready" ? guest.email : null}
              planHome={guest.kind === "ready" ? guest.planHome : "/dashboard"}
              loginHref="/login"
              t={c.guest}
            />
          </div>
        </section>
      </div>
    );
  }

  const confirmation =
    sessionId && sessionId.startsWith("cs_") ? await loadConfirmation(sessionId) : null;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const money = (minor: number, currency: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);

  return (
    <div className={s.page}>
      <PublicNav locale={locale} />

      <section className={s.section}>
        <div className={`${s.container} ${g.article}`}>
          <p className={s.label}>
            <b>/ {c.eyebrow}</b>
          </p>
          <h1 className={s.h2}>{c.title}</h1>

          {confirmation ? (
            <>
              <p className={s.sub}>{confirmation.planName ? c.confirmed(confirmation.planName) : c.generic}</p>

              <div className={g.needsBox}>
                <h2 className={g.needsTitle}>{c.trialLen(TRIAL_DAYS)}</h2>
                <ul className={g.needsList}>
                  {confirmation.trialEnd && (
                    <li>
                      {c.trialUntil} {dateFmt.format(confirmation.trialEnd)}
                    </li>
                  )}
                  {confirmation.amountMinor !== null && confirmation.currency && (
                    <li>
                      {c.thenCharged} {money(confirmation.amountMinor, confirmation.currency)}
                      {confirmation.interval ? ` / ${confirmation.interval}` : ""}
                    </li>
                  )}
                </ul>
              </div>

              <p className={g.para} style={{ marginTop: 16 }}>
                {confirmation.amountMinor !== null ? c.autoCharge : c.noAmount}
              </p>
            </>
          ) : (
            <>
              <p className={s.sub}>{c.generic}</p>
              <p className={g.uiNote}>{c.pending}</p>
            </>
          )}

          <div className={s.ctarow} style={{ marginTop: 28 }}>
            <Link
              className={`${s.btn} ${s.btnPrimary}`}
              href={confirmation?.planHome ?? "/dashboard"}
            >
              {c.ctaApp}
            </Link>
            <Link className={`${s.btn} ${s.btnGhost}`} href="/billing">
              {c.ctaBilling}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

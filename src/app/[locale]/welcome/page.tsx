// Post-checkout landing page. Stripe's success_url points here.
//
// THIS PAGE CONFIRMS, IT DOES NOT ENTITLE. The checkout session id in the URL
// is a display hint and nothing more: it is user-supplied, and a visitor could
// paste anyone's. Plan access comes from the Stripe webhook writing the
// Subscription row, which is the only source of truth. Nothing here reads or
// changes tenant state.
//
// It must never throw. A missing, malformed, expired or foreign session id all
// fall back to a generic welcome — someone who has just paid should not meet an
// error page because a query string was mangled in an email client.
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
  searchParams: Promise<{ s?: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();
  const { s: sessionId } = await searchParams;
  const c = COPY[baseOf(locale)];

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

// Post-checkout landing page. Stripe's success_url points here
// (/{locale}/welcome?s={CHECKOUT_SESSION_ID}; ?session_id= is accepted too).
//
// TWO CONTRACTS, AND metadata.flow ON THE SESSION IS WHAT PICKS BETWEEN THEM.
//
// flow=upgrade (every checkout the app creates today) — THE HANDOFF
// (PLAN-HUB Part 1, src/lib/billing/checkout-handoff.ts). The session id is a
// display hint: plan-specific words appear only when Stripe says the session is
// complete AND it belongs to the signed-in tenant. Then:
//   a) the tenant already shows the bought plan, paid → /plan?welcome=1 at once;
//   b) not yet → "Payment confirmed. Setting up your {Plan}…", polling
//      /api/billing/status every 2 s for up to ~60 s, then /plan;
//   c) still not → "Still finishing", a button to /plan, the support address.
// Every other case (logged out, garbage, expired, another tenant's) is ONE
// generic state: "Thanks. Sign in to see your plan." Entitlement still comes
// from the webhook; nothing here writes account state.
//
// flow=guest_signup — the retired checkout-first path, kept for links already
// in inboxes: the session id is a CREDENTIAL for setting the first password,
// once. Every rule lives in src/lib/billing/guest-welcome.ts.
//
// Credit packs return to /credits (their own success_url); a credit session
// pasted here is sent back there, never to the plan hub.
//
// IT MUST NEVER THROW, ON ANY PATH, AND NEVER RENDER BLANK OR A LOCK SCREEN.
//
// LOCALE MODEL: en / fr / de bases (en-CA folds to en, fr-CA to fr, de-CH to
// de). The retired guest flow's own strings are en/fr only; de-CH reads them
// in English.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_LOCALES, isSupportedLocale, type Locale } from "@/lib/i18n/config";
import { buildMetadata } from "@/lib/seo";
import { auth } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { resolveGuestSession } from "@/lib/billing/guest-welcome";
import { resolveHandoff } from "@/lib/billing/checkout-handoff";
import { GuestSetup } from "./GuestSetup";
import { WelcomeHandoff, type WelcomeHandoffCopy } from "./WelcomeHandoff";
import { PublicNav } from "../PublicNav";
import s from "../home2.module.css";
import g from "../guides/_shared/guide.module.css";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type Base = "en" | "fr" | "de";
const baseOf = (locale: string): Base => (locale.startsWith("fr") ? "fr" : locale.startsWith("de") ? "de" : "en");

/**
 * Where the generic state sends a visitor, and where login returns them. The
 * login page honours `callbackUrl` (same-origin paths only), not `next`.
 */
const WELCOME_SIGN_IN_HREF = "/login?callbackUrl=%2Fplan";

const GUEST_EN = {
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
};

const COPY: Record<Base, {
  eyebrow: string;
  title: string;
  genericTitle: string;
  genericBody: string;
  signIn: string;
  handoff: WelcomeHandoffCopy;
  guest: typeof GUEST_EN;
}> = {
  en: {
    eyebrow: "WELCOME",
    title: "You're in.",
    genericTitle: "Thanks. Sign in to see your plan.",
    genericBody: "Your plan, what it includes and its billing details are on your plan page once you are signed in.",
    signIn: "Sign in",
    handoff: {
      confirmed: (plan) => `Payment confirmed. Setting up your ${plan}…`,
      opening: "Opening your plan…",
      waitingNote: "This usually takes a few seconds. The page moves on by itself.",
      stillTitle: "Still finishing. This can take a few minutes.",
      stillBody: "Your payment went through. Your plan page will show everything as soon as the confirmation from Stripe arrives.",
      openPlan: "Open your plan",
      supportLead: "Something not right? Write to",
    },
    guest: GUEST_EN,
  },
  fr: {
    eyebrow: "BIENVENUE",
    title: "C'est parti.",
    genericTitle: "Merci. Connectez-vous pour voir votre forfait.",
    genericBody: "Votre forfait, ce qu'il comprend et sa facturation se trouvent sur la page de votre forfait, une fois connecté.",
    signIn: "Se connecter",
    handoff: {
      confirmed: (plan) => `Paiement confirmé. Préparation de votre forfait ${plan}…`,
      opening: "Ouverture de votre forfait…",
      waitingNote: "Cela prend d'habitude quelques secondes. La page avance toute seule.",
      stillTitle: "C'est presque prêt. Cela peut prendre quelques minutes.",
      stillBody: "Votre paiement est passé. La page de votre forfait affichera tout dès que la confirmation de Stripe sera arrivée.",
      openPlan: "Ouvrir votre forfait",
      supportLead: "Un souci ? Écrivez à",
    },
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
  de: {
    eyebrow: "WILLKOMMEN",
    title: "Sie sind dabei.",
    genericTitle: "Danke. Melden Sie sich an, um Ihr Abo zu sehen.",
    genericBody: "Ihr Abo, was es umfasst und die Abrechnung finden Sie nach der Anmeldung auf Ihrer Abo-Seite.",
    signIn: "Anmelden",
    handoff: {
      confirmed: (plan) => `Zahlung bestätigt. Ihr ${plan}-Abo wird eingerichtet…`,
      opening: "Ihr Abo wird geöffnet…",
      waitingNote: "Das dauert meist nur wenige Sekunden. Die Seite geht von selbst weiter.",
      stillTitle: "Gleich fertig. Das kann einige Minuten dauern.",
      stillBody: "Ihre Zahlung ist eingegangen. Ihre Abo-Seite zeigt alles, sobald die Bestätigung von Stripe eintrifft.",
      openPlan: "Abo öffnen",
      supportLead: "Stimmt etwas nicht? Schreiben Sie an",
    },
    // The retired guest flow was never translated into German.
    guest: GUEST_EN,
  },
};

const META: Record<Base, { title: string; description: string }> = {
  en: { title: "Welcome to Echorank", description: "Your Echorank plan is being set up." },
  fr: { title: "Bienvenue sur Echorank", description: "Votre forfait Echorank est en cours de préparation." },
  de: { title: "Willkommen bei Echorank", description: "Ihr Echorank-Abo wird eingerichtet." },
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

  // THE NAV IS TOLD, NOT LEFT TO GUESS: a buyer arriving from Stripe is
  // signed in, and the first paint must not invite them to join.
  const session = await auth();
  const signedIn = Boolean(session?.user);

  // THE GUEST BRANCH IS TRIED FIRST, AND ONLY A COMPLETE guest_signup SESSION
  // GETS PAST IT. resolveGuestSession collapses every reject to `invalid`.
  const guest =
    sessionId && sessionId.startsWith("cs_") ? await resolveGuestSession(sessionId) : null;

  const shell = (body: React.ReactNode) => (
    <div className={s.page}>
      <PublicNav locale={locale} signedIn={signedIn} />
      <section className={s.section}>
        <div className={`${s.container} ${g.article}`}>
          <p className={s.label}>
            <b>/ {c.eyebrow}</b>
          </p>
          <h1 className={s.h2}>{c.title}</h1>
          {body}
        </div>
      </section>
    </div>
  );

  if (guest && guest.kind !== "invalid") {
    return shell(
      <GuestSetup
        sessionId={sessionId!}
        initialKind={guest.kind}
        email={guest.kind === "ready" ? guest.email : null}
        planHome={guest.kind === "ready" ? guest.planHome : "/dashboard"}
        loginHref="/login"
        t={c.guest}
      />,
    );
  }

  // THE HANDOFF. getCurrentTenant() is the signed-in user's active tenant;
  // resolveHandoff never throws and answers "generic" for everything it cannot
  // verify as this tenant's complete checkout.
  const membership = signedIn ? await getCurrentTenant().catch(() => null) : null;
  const handoff = await resolveHandoff(
    sessionId,
    membership
      ? {
          tenantId: membership.tenantId,
          planType: membership.tenant.planType,
          stripeCustomerId: membership.tenant.stripeCustomerId ?? null,
        }
      : null,
  );

  if (handoff.kind === "credits") {
    redirect(`/${locale}/credits?purchased=${encodeURIComponent(handoff.sessionId)}`);
  }
  // State (a) with nothing to report: straight on. With a conversion to
  // report, the client fires it once and moves on in the same paint.
  if (handoff.kind === "ready" && !handoff.conversion) {
    redirect("/plan?welcome=1");
  }

  if (handoff.kind === "ready" || handoff.kind === "pending") {
    return shell(
      <WelcomeHandoff
        mode={handoff.kind}
        plan={handoff.plan}
        planName={PLAN_CONFIGS[handoff.plan].name}
        conversion={handoff.conversion}
        t={c.handoff}
      />,
    );
  }

  return shell(
    <div data-testid="welcome-generic">
      <p className={s.sub}>{c.genericTitle}</p>
      <p className={g.uiNote}>{c.genericBody}</p>
      <div className={s.ctarow} style={{ marginTop: 28 }}>
        <Link className={`${s.btn} ${s.btnPrimary}`} href={WELCOME_SIGN_IN_HREF}>
          {c.signIn}
        </Link>
      </div>
    </div>,
  );
}

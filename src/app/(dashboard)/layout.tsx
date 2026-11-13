import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ASSISTANT_COPY, BILLING_COPY, dashboardLocale } from "@/lib/i18n/dashboard";
import { PlanEndedBanner } from "@/components/billing/plan-ended-banner";
import { auth } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { getBillingContext, isPaidStatus } from "@/lib/paid-plan";
import { isNoneAllowedPath } from "@/lib/billing-gate";
import { assistantEnabled, assistantLinkVisible } from "@/lib/assistant/config";
import { unreadNotificationCount } from "@/lib/notifications/store";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AssistantWidgetLoader } from "@/components/assistant/AssistantWidgetLoader";
import { OnboardingGate } from "@/components/onboarding/welcome-setup-modal";
import { PlanUpgradeScreen } from "@/components/billing/PlanUpgradeScreen";
import { planAllowsArea, planAllowsPage, planIsRestricted } from "@/lib/plan-access";
import { PLAN_HOME } from "@/lib/plan-routing";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  if (!session?.user) {
    redirect("/login");
  }

  const membership = await getCurrentTenant();
  const plan = membership?.tenant.planType;

  // ── THE PLAN ALLOWLIST (src/lib/plan-access.ts) ─────────────────────────
  // A restricted plan reaches only its areas: the AI-only plan AI
  // visibility, account and help pages (home /visibility); the crawler-only
  // plan the crawler, its Google connections and the account basics (home
  // /crawler). Any other page renders the upgrade screen here, server-side,
  // instead of the page. FAILS CLOSED like the billing gate below: with no
  // x-pathname a restricted plan gets the upgrade screen.
  const pathname = (await headers()).get("x-pathname");
  let excluded = false;
  if (plan && planIsRestricted(plan)) {
    if (pathname === "/dashboard") redirect(PLAN_HOME[plan]);
    excluded = !pathname || !planAllowsPage(plan, pathname);
  }

  // ── THE BILLING GATE, AND THE ONLY PLACE IT LIVES ────────────────────────
  //
  // ONE getBillingContext CALL ANSWERS BOTH QUESTIONS. `paid` drives what the
  // sidebar shows; `needsPlanSelection` decides whether this tenant may be here
  // at all. Reading them from one context is what makes it impossible for the
  // gate and requirePaidPlan to disagree about the same tenant — see
  // src/lib/billing-gate.ts for why this is not in the proxy.
  const billing = membership
    ? await getBillingContext(membership.tenantId)
    : null;

  // Paid (ACTIVE billing, or a real Stripe trial) drives SEO Tools visibility
  // in the sidebar; the tools layout re-checks server-side, so this is
  // presentation only.
  const paid = billing ? isPaidStatus(billing.status, billing.hasSubscriptionRow) : false;
  const planEnded = billing?.status === "CANCELED";

  // A tenant that has never subscribed is sent to pick a plan. NOT an error
  // page and NOT a modal: they have an account, they are signed in, and the
  // one thing missing is a plan — so the destination is the page that sells
  // them one, where (being signed in) a single click now goes straight to
  // Stripe with no second registration.
  //
  // THE EXEMPT PATHS ARE CHECKED FIRST. /settings/account has to stay reachable
  // or a user who wants to leave cannot find out what they are leaving.
  //
  // x-pathname is stamped by src/proxy.ts for authenticated app routes; a
  // layout cannot read the pathname any other way. If it is somehow absent we
  // fail CLOSED (redirect), because the alternative is a gate that silently
  // stops applying the moment a header goes missing.
  if (billing?.needsPlanSelection) {
    if (!isNoneAllowedPath(pathname)) {
      redirect(`/${locale}/pricing`);
    }
  }

  // Resolved here so the bell is correct on first paint rather than flashing
  // an empty badge while the client fetches. The header re-reads it on every
  // navigation; this is only the seed value.
  // The bell is the notification centre's entry point: a plan without that
  // area (the crawler-only plan) gets no bell and no count read.
  const notificationsOn = planAllowsArea(plan, "notifications");
  const unreadCount =
    membership && notificationsOn
      ? await unreadNotificationCount(membership.tenantId, membership.userId)
      : 0;

  // The Pro assistant's visibility, decided HERE and passed down as a boolean.
  // Server-derived on purpose: a client-side plan check is a suggestion, and
  // this one decides whether a paid surface appears at all. Non-qualifying
  // tenants get no widget, no sidebar row and no upsell teaser — this phase
  // ships no upsell surface.
  //
  // BOTH SWITCHES. `assistantEnabled()` is the runtime kill switch the API
  // routes enforce; `assistantLinkVisible()` is its build-time NEXT_PUBLIC twin,
  // the same pair the public assistant's nav link uses. Either one off hides
  // the feature, and the routes refuse regardless of what the UI did.
  const assistantVisible =
    paid && planAllowsArea(plan, "assistant") && assistantEnabled() && assistantLinkVisible();

  return (
    <DashboardShell
      locale={locale}
      plan={plan}
      paid={paid}
      assistantVisible={assistantVisible}
      unreadCount={unreadCount}
      notifications={notificationsOn}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      {/* The welcome step belongs to the home dashboard (it leads into the
          first AI audit): not on a plan without one (the crawler-only plan). */}
      {planAllowsArea(plan, "home") && <OnboardingGate locale={locale} />}
      {/* An ended plan (CANCELED) is still a usable account: every page says
          so, with the way back, above whatever that page renders. Not on
          /billing itself, whose plan card already says it. */}
      {planEnded && !pathname?.startsWith("/billing") && <PlanEndedBanner t={BILLING_COPY[locale]} />}
      {excluded ? <PlanUpgradeScreen locale={locale} plan={plan} /> : children}
      {/* Mounted once for the whole (dashboard) group, so a navigation does not
          reset an open conversation. Lazily loaded — see the loader. */}
      {assistantVisible && (
        <AssistantWidgetLoader c={ASSISTANT_COPY[locale]} fullHref="/assistant" />
      )}
    </DashboardShell>
  );
}

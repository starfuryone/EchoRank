import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { ASSISTANT_COPY, dashboardLocale } from "@/lib/i18n/dashboard";
import { auth } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { getBillingContext, isPaidStatus } from "@/lib/paid-plan";
import { isNoneAllowedPath } from "@/lib/billing-gate";
import { assistantEnabled, assistantLinkVisible } from "@/lib/assistant/config";
import { unreadNotificationCount } from "@/lib/notifications/store";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AssistantWidgetLoader } from "@/components/assistant/AssistantWidgetLoader";
import { OnboardingGate } from "@/components/onboarding/welcome-setup-modal";

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

  // No route allowlist: every tier reaches every dashboard path. The retired
  // AI_VISIBILITY tier was the only confined one, and feature gates
  // (requireFeature) rather than path prefixes are what guard capability now.
  const membership = await getCurrentTenant();
  const plan = membership?.tenant.planType;

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
    const pathname = (await headers()).get("x-pathname");
    if (!isNoneAllowedPath(pathname)) {
      redirect(`/${locale}/pricing`);
    }
  }

  // Resolved here so the bell is correct on first paint rather than flashing
  // an empty badge while the client fetches. The header re-reads it on every
  // navigation; this is only the seed value.
  const unreadCount = membership
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
  const assistantVisible = paid && assistantEnabled() && assistantLinkVisible();

  return (
    <DashboardShell
      locale={locale}
      plan={plan}
      paid={paid}
      assistantVisible={assistantVisible}
      unreadCount={unreadCount}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      <OnboardingGate locale={locale} />
      {children}
      {/* Mounted once for the whole (dashboard) group, so a navigation does not
          reset an open conversation. Lazily loaded — see the loader. */}
      {assistantVisible && (
        <AssistantWidgetLoader c={ASSISTANT_COPY[locale]} fullHref="/assistant" />
      )}
    </DashboardShell>
  );
}

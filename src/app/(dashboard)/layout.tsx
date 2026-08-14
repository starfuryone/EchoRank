import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { auth } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { hasPaidPlan } from "@/lib/paid-plan";
import { unreadNotificationCount } from "@/lib/notifications/store";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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

  // Paid (ACTIVE billing) drives SEO Tools visibility in the sidebar; the
  // tools layout re-checks server-side, so this is presentation only.
  const paid = membership ? await hasPaidPlan(membership.tenantId) : false;

  // Resolved here so the bell is correct on first paint rather than flashing
  // an empty badge while the client fetches. The header re-reads it on every
  // navigation; this is only the seed value.
  const unreadCount = membership
    ? await unreadNotificationCount(membership.tenantId, membership.userId)
    : 0;

  return (
    <DashboardShell
      locale={locale}
      plan={plan}
      paid={paid}
      unreadCount={unreadCount}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
    >
      <OnboardingGate locale={locale} />
      {children}
    </DashboardShell>
  );
}

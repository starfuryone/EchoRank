import { cookies } from "next/headers";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/feature-flags";
import { activeMatrixAccount } from "@/lib/matrix-accounts";
import { ELEMENT_URL } from "@/app/api/account/matrix/provision/route";
import { AccountPageClient } from "./page-client";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);

  // Guard: requireTenant only — no role check, no plan/feature gate.
  const membership = await requireTenant();
  const session = await auth();

  const tenant = await prisma.tenant.findUnique({
    where: { id: membership.tenantId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      planType: true,
      billingStatus: true,
    },
  });

  // A tenant may have no Subscription row at all (trials, manual/legacy
  // accounts). That is not an error: fall back to tenant.billingStatus.
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: membership.tenantId },
    select: { planType: true, status: true, stripePriceId: true },
  });

  // Price catalog lookup is best-effort; a stale or missing price must not
  // take the page down.
  let price: { currency: string; interval: string } | null = null;
  if (subscription?.stripePriceId) {
    const row = await prisma.stripePrice.findUnique({
      where: { stripePriceId: subscription.stripePriceId },
      select: { currency: true, interval: true },
    });
    if (row) price = { currency: row.currency, interval: row.interval };
  }

  // Team chat eligibility and any existing account, resolved server-side so
  // the client never has to ask whether the plan qualifies.
  const chatEligible = tenant ? hasFeature(tenant.planType, "matrix_chat") : false;
  const chatAccount = chatEligible
    ? await activeMatrixAccount(membership.tenantId, membership.userId)
    : null;

  return (
    <AccountPageClient
      locale={locale}
      user={{ name: session?.user?.name ?? null, email: session?.user?.email ?? null }}
      tenant={{
        name: tenant?.name ?? "",
        createdAt: tenant?.createdAt?.toISOString() ?? null,
        planType: tenant?.planType ?? null,
        billingStatus: tenant?.billingStatus ?? null,
      }}
      subscription={
        subscription
          ? { planType: subscription.planType, status: subscription.status }
          : null
      }
      price={price}
      chat={{
        eligible: chatEligible,
        existingMxid: chatAccount?.mxid ?? null,
        elementUrl: ELEMENT_URL,
      }}
    />
  );
}

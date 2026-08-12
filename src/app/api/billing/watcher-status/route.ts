// GET /api/billing/watcher-status — what the Watcher CTA should say.
//
// PRESENTATION ONLY. Nothing here authorises anything: the purchase is gated by
// POST /api/billing/checkout, which runs watcherCheckoutBlock itself. This
// exists so the pricing card can render the answer a buyer would get instead of
// showing a buy button that 400s the moment it is clicked.
//
// It calls THE SAME guard with THE SAME input as the checkout route. A
// hand-rolled "does this tenant look paid" check here is exactly how a button
// and its endpoint drift apart — the button would keep offering a purchase the
// server has already decided to refuse, and the buyer sees an error instead of
// an explanation.
//
// The marketing page stays statically rendered because this is fetched after
// mount rather than read at the top of the page: calling auth() during render
// makes the page dynamic for anonymous visitors too, who are most of them. The
// anonymous answer is also the card's default, so the static HTML is already
// correct for that case and only ever upgrades.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hasWatcherEntitlement,
  watcherCheckoutBlock,
  type SubscriptionFacts,
} from "@/lib/ai-monitor/watcher-entitlement";
import { getCurrentTenant } from "@/lib/tenant";

/** What the card should render. */
export type WatcherCtaState = "buy" | "included" | "manage";

export async function GET() {
  let tenantId: string | null = null;
  try {
    const membership = await getCurrentTenant();
    tenantId = membership?.tenant.id ?? null;
  } catch {
    // A failed session lookup is not an error worth surfacing on a pricing
    // page: the buy button is the right thing to show a visitor we cannot
    // identify, and checkout will answer 401 and route them to /register.
    tenantId = null;
  }
  if (!tenantId) return NextResponse.json({ state: "buy" satisfies WatcherCtaState });

  const row = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { productKind: true, status: true },
  });
  // TRIALING counts as active here for the same reason it does at checkout: a
  // trialling plan already includes the watcher, so offering it is still the
  // double-charge the guard exists to prevent.
  const facts: SubscriptionFacts | null = row
    ? {
        productKind: row.productKind,
        active: row.status === "ACTIVE" || row.status === "TRIALING",
      }
    : null;

  if (watcherCheckoutBlock(facts).blocked) {
    return NextResponse.json({ state: "included" satisfies WatcherCtaState });
  }
  if (hasWatcherEntitlement(facts)) {
    return NextResponse.json({ state: "manage" satisfies WatcherCtaState });
  }
  return NextResponse.json({ state: "buy" satisfies WatcherCtaState });
}

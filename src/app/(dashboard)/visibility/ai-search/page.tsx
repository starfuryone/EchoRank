import Link from "next/link";
import { requireTenant } from "@/lib/tenant";
import { aiSearchEnabledFor } from "@/lib/ai-monitor/rollout";
import {
  listBrands,
  readCheckupHistory,
  readMetrics,
  readTopCitationDomains,
  readTopCompetitors,
} from "@/lib/ai-monitor/dashboard/read";
import { AiSearchOverview } from "./overview-client";

/**
 * AI Search overview.
 *
 * READ ONLY. Every number on this page was written by the runner; nothing is
 * recomputed here or in the browser. Rows carrying a score version this build
 * does not know are gated out by readMetrics and rendered as an explicit
 * unsupported state rather than shown under a label that would be a lie.
 *
 * THE GATE IS A FIRST-CLASS STATE, not a 404. Step 4's wizard creates brands
 * whether or not the rollout flag covers the tenant, so "you have a brand and
 * nothing is running" is a real situation with a real explanation — telling
 * someone their data does not exist would be false.
 */
export default async function AiSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const membership = await requireTenant();
  const { brand: requestedBrand } = await searchParams;

  const brands = await listBrands(membership.tenantId);
  const gateOn = aiSearchEnabledFor(membership.tenantId);

  if (brands.length === 0) {
    return (
      <EmptyShell title="AI Search">
        <p className="text-sm text-gray-600">
          Track whether AI assistants recommend you when your buyers ask.
        </p>
        <Link
          href="/visibility/ai-search/setup"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Set up tracking
        </Link>
      </EmptyShell>
    );
  }

  const brand = brands.find((b) => b.id === requestedBrand) ?? brands[0];

  // State (a): a brand exists but nothing will ever run for it, because the
  // surface is not switched on for this tenant. Explaining that beats a
  // dashboard of zeros, which reads as "you are invisible" rather than "we have
  // not looked".
  if (!gateOn) {
    return (
      <EmptyShell title={brand.name}>
        <p className="text-sm text-gray-600">
          Tracking is set up but AI Search is not enabled for your account yet, so no checkups
          have run. Nothing has been charged.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Contact support to switch it on — your {brand.promptCount} questions are saved and the
          first checkup starts as soon as it is.
        </p>
      </EmptyShell>
    );
  }

  const [metrics, competitors, citationDomains, history] = await Promise.all([
    readMetrics(brand.id),
    readTopCompetitors(brand.id),
    readTopCitationDomains(brand.id),
    readCheckupHistory(brand.id),
  ]);

  return (
    <AiSearchOverview
      brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      brand={{ id: brand.id, name: brand.name, promptCount: brand.promptCount }}
      metrics={metrics}
      competitors={competitors}
      citationDomains={citationDomains}
      history={history}
      timezone={membership.tenant.timezone}
    />
  );
}

function EmptyShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <div className="mt-3">{children}</div>
    </div>
  );
}

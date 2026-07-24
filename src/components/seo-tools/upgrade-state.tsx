// Localized upgrade state shown in place of ANY /visibility/tools/* content
// when the tenant's effective billing status is not ACTIVE (free/trial/
// past-due/canceled). Rendered by the tools layout — a clean state with a
// billing CTA, deliberately not a 404 or a bare 403.
import Link from "next/link";
import { Lock } from "lucide-react";
import { SEO_TOOLS_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function UpgradeState({ locale }: { locale: DashLocale }) {
  const copy = SEO_TOOLS_COPY[locale];
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          {copy.hubTitle}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{copy.hubSubtitle}</p>
      </div>

      <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-7 w-7 text-gray-400" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{copy.upgradeTitle}</h3>
        <p className="mt-2 max-w-md text-sm text-gray-500">{copy.upgradeBody}</p>
        <Link
          href="/billing"
          className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {copy.upgradeCta}
        </Link>
      </div>
    </div>
  );
}

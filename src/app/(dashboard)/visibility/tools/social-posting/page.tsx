// Social posting, by EchoPilot. Social posting stays in our sister product
// EchoPilot (2026-11-08): Echorank promotes it instead of building it. A short
// page — what EchoPilot does, its launch offer while open, and a CTA to its
// pricing in a new tab. Every paid plan sees it, the AI-only one included
// (src/lib/plan-access.ts); the paid gate is ../layout.tsx.
import { cookies } from "next/headers";
import { Share2 } from "lucide-react";
import { dashboardLocale } from "@/lib/i18n/dashboard";
import { ECHOPILOT_COPY } from "@/lib/i18n/echopilot";
import { echopilotLaunchOfferOpen } from "@/lib/echopilot";
import { EchopilotCta } from "@/components/seo-tools/echopilot-cta";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = dashboardLocale(cookieStore.get("echorank_locale")?.value);
  const t = ECHOPILOT_COPY[locale];
  const offerOpen = echopilotLaunchOfferOpen();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <Share2 className="mt-1 h-6 w-6 shrink-0 text-gray-400" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-600">{t.lead}</p>
        </div>
      </div>

      <section aria-labelledby="echopilot-what" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 id="echopilot-what" className="text-sm font-semibold text-gray-900">
          {t.whatTitle}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
          {t.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>

      {offerOpen && (
        <p data-echopilot-offer="" className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {t.offer}
        </p>
      )}

      <div className="space-y-2">
        <EchopilotCta label={t.cta} newTab={t.newTab} />
        <p className="text-xs text-gray-500">{t.note}</p>
      </div>
    </div>
  );
}

import { cookies } from 'next/headers';
import RiskDashboard from '@/components/intelligence/RiskDashboard';
import { ReportDownloadButton } from '@/components/reports/ReportDownloadButton';
import { RISK_PAGE_COPY, dashboardLocale } from '@/lib/i18n/dashboard';

// Move this folder into your dashboard route group if you use one,
// e.g. app/(dashboard)/intelligence/risk/ — imports are relative, they hold.

export const metadata = { title: 'Reputation Risk — EchoRank' };

export default async function RiskPage() {
  const locale = dashboardLocale((await cookies()).get('echorank_locale')?.value);
  const t = RISK_PAGE_COPY[locale];
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-teal-400">{t.eyebrow}</p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-100">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-400">{t.subtitle}</p>
        </div>
        <ReportDownloadButton endpoint="/api/intelligence/report" />
      </header>
      <RiskDashboard locale={locale} />
    </main>
  );
}

import { cookies } from 'next/headers';
import { BackLink } from '@/components/ui/back-link';
import CompetitorsPanel from '@/components/intelligence/CompetitorsPanel';
import { ReportDownloadButton } from '@/components/reports/ReportDownloadButton';
import { COMPETITORS_PAGE_COPY, dashboardLocale } from '@/lib/i18n/dashboard';

export const metadata = { title: 'Competitor Intelligence — Echorank360' };

export default async function CompetitorsPage() {
  const locale = dashboardLocale((await cookies()).get('echorank_locale')?.value);
  const t = COMPETITORS_PAGE_COPY[locale];
  return (
    <main className="mx-auto max-w-6xl">
      <BackLink href="/intelligence">{t.back}</BackLink>
      <header className="mb-6 mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-400">{t.eyebrow}</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <ReportDownloadButton endpoint="/api/intelligence/report" />
      </header>
      <CompetitorsPanel locale={locale} />
    </main>
  );
}

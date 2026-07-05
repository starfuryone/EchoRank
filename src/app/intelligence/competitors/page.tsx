import CompetitorsPanel from '../../../components/intelligence/CompetitorsPanel';

export const metadata = { title: 'Competitor Intelligence — EchoRank' };

export default function CompetitorsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-teal-400">Intelligence</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">Competitors</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Daily rating and review-count snapshots. Momentum alerts fire when a competitor
          clearly outpaces your own review velocity.
        </p>
      </header>
      <CompetitorsPanel />
    </main>
  );
}

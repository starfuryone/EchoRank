import RiskDashboard from '../../../components/intelligence/RiskDashboard';

// Move this folder into your dashboard route group if you use one,
// e.g. app/(dashboard)/intelligence/risk/ — imports are relative, they hold.

export const metadata = { title: 'Reputation Risk — EchoRank360' };

export default function RiskPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-teal-400">Intelligence</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-100">Reputation risk</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Unified score across reviews, private feedback and AI visibility — recomputed hourly.
        </p>
      </header>
      <RiskDashboard />
    </main>
  );
}

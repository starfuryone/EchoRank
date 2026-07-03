import { Worker } from 'bullmq';
import { prisma } from '../lib/signals/db';
import { SIGNALS_RISK_QUEUE, riskQueue } from '../lib/signals/queue';
import { getRedisConnection } from '@/infrastructure/redis/connection';
import { computeAndPersist } from '../lib/signals/scoring';
import { syncRecentSignals } from '../lib/signals/sync';

async function recomputeAll(): Promise<number> {
  const synced = await syncRecentSignals(2);
  if (synced) console.log('[signals] synced ' + synced + ' recent rows');
  const tenants = await prisma.signal.findMany({
    distinct: ['tenantId'],
    select: { tenantId: true },
  });
  let ok = 0;
  for (const { tenantId } of tenants) {
    try {
      const r = await computeAndPersist(tenantId);
      console.log(`[signals] ${tenantId} → risk ${r.score} (${r.grade}), ${r.signalCount} signals`);
      ok++;
    } catch (err) {
      console.error(`[signals] recompute failed for ${tenantId}:`, (err as Error).message);
    }
  }
  return ok;
}

export function startSignalsWorker(): Worker {
  const worker = new Worker(
    SIGNALS_RISK_QUEUE,
    async (job) => {
      if (job.name === 'recompute-tenant') {
        const { tenantId } = job.data as { tenantId: string };
        const r = await computeAndPersist(tenantId);
        return { tenantId, score: r.score, grade: r.grade };
      }
      if (job.name === 'recompute-all') {
        const n = await recomputeAll();
        return { tenants: n };
      }
    },
    { connection: getRedisConnection(), concurrency: 2 },
  );

  worker.on('failed', (job, err) =>
    console.error(`[signals] job ${job?.name} failed:`, err.message),
  );

  // Hourly full sweep — jobId makes this idempotent across restarts.
  riskQueue()
    .add('recompute-all', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'recompute-hourly' })
    .catch((err) => console.error('[signals] schedule failed:', (err as Error).message));

  console.log('[signals] risk worker started (hourly sweep + on-demand)');
  return worker;
}

// Standalone mode: SIGNALS_WORKER_STANDALONE=1 npx tsx src/workers/signals.worker.ts
if (process.env.SIGNALS_WORKER_STANDALONE === '1') {
  startSignalsWorker();
}

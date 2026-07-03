import { Queue } from 'bullmq';
import { getRedisConnection } from '@/infrastructure/redis/connection';

export const SIGNALS_RISK_QUEUE = 'signals-risk';

let _queue: Queue | null = null;

export function riskQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(SIGNALS_RISK_QUEUE, { connection: getRedisConnection() });
  }
  return _queue;
}

/** Debounced per-tenant recompute. Never throws — Redis down must not break ingestion. */
export async function enqueueRecompute(tenantId: string): Promise<void> {
  try {
    await riskQueue().add(
      'recompute-tenant',
      { tenantId },
      { jobId: `recompute-${tenantId}`, removeOnComplete: 100, removeOnFail: 50, delay: 5_000 },
    );
  } catch (err) {
    console.error('[signals] enqueueRecompute failed (non-fatal):', (err as Error).message);
  }
}

import { createHash } from 'crypto';
import { prisma } from './db';
import { clamp, RawSignalInput, SIGNAL_SOURCES } from './types';
import { enqueueRecompute } from './queue';

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function dedupeHashFor(s: RawSignalInput): string {
  const key = s.externalId
    ? `${s.tenantId}|${s.source}|${s.externalId}`
    : `${s.tenantId}|${s.source}|${s.occurredAt.toISOString()}|${s.title ?? ''}|${(s.body ?? '').slice(0, 512)}`;
  return sha256(key);
}

export function validateRawSignal(s: unknown): { ok: true; value: RawSignalInput } | { ok: false; error: string } {
  const x = s as Record<string, unknown>;
  if (!x || typeof x !== 'object') return { ok: false, error: 'not an object' };
  if (typeof x.tenantId !== 'string' || !x.tenantId) return { ok: false, error: 'tenantId required' };
  if (typeof x.source !== 'string' || !SIGNAL_SOURCES.includes(x.source as never)) {
    return { ok: false, error: `source must be one of ${SIGNAL_SOURCES.join(', ')}` };
  }
  const occurredAt = new Date(x.occurredAt as string);
  if (Number.isNaN(occurredAt.getTime())) return { ok: false, error: 'occurredAt invalid' };
  if (typeof x.sentiment !== 'number') return { ok: false, error: 'sentiment (number) required' };
  if (typeof x.severity !== 'number') return { ok: false, error: 'severity (number) required' };

  return {
    ok: true,
    value: {
      tenantId: x.tenantId,
      source: x.source as RawSignalInput['source'],
      externalId: (x.externalId as string) ?? null,
      entityType: (x.entityType as string) ?? null,
      entityId: (x.entityId as string) ?? null,
      occurredAt,
      sentiment: clamp(x.sentiment as number, -1, 1),
      severity: clamp(x.severity as number, 0, 1),
      magnitude: x.magnitude === undefined ? 0.5 : clamp(x.magnitude as number, 0, 1),
      title: (x.title as string) ?? null,
      body: (x.body as string) ?? null,
      url: (x.url as string) ?? null,
      metadata: (x.metadata as Record<string, unknown>) ?? undefined,
    },
  };
}

/**
 * Upsert one signal. Safe to call repeatedly for the same source record —
 * dedupeHash makes it idempotent; edits in the source (rating changed,
 * review updated) overwrite the scored fields.
 */
export async function ingestSignal(input: RawSignalInput) {
  const dedupeHash = dedupeHashFor(input);
  const data = {
    tenantId: input.tenantId,
    source: input.source,
    externalId: input.externalId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    occurredAt: input.occurredAt,
    sentiment: clamp(input.sentiment, -1, 1),
    severity: clamp(input.severity, 0, 1),
    magnitude: clamp(input.magnitude ?? 0.5, 0, 1),
    title: input.title ?? null,
    body: input.body ?? null,
    url: input.url ?? null,
    metadata: (input.metadata ?? undefined) as never,
  };
  return prisma.signal.upsert({
    where: { dedupeHash },
    create: { ...data, dedupeHash },
    update: {
      sentiment: data.sentiment,
      severity: data.severity,
      magnitude: data.magnitude,
      title: data.title,
      body: data.body,
      url: data.url,
      metadata: data.metadata,
    },
  });
}

/** Batch upsert in chunks. Returns count processed. */
export async function ingestSignals(inputs: RawSignalInput[], opts?: { recompute?: boolean }) {
  const CHUNK = 50;
  let n = 0;
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const chunk = inputs.slice(i, i + CHUNK);
    await prisma.$transaction(chunk.map((s) => {
      const dedupeHash = dedupeHashFor(s);
      return prisma.signal.upsert({
        where: { dedupeHash },
        create: {
          dedupeHash,
          tenantId: s.tenantId,
          source: s.source,
          externalId: s.externalId ?? null,
          entityType: s.entityType ?? null,
          entityId: s.entityId ?? null,
          occurredAt: s.occurredAt,
          sentiment: clamp(s.sentiment, -1, 1),
          severity: clamp(s.severity, 0, 1),
          magnitude: clamp(s.magnitude ?? 0.5, 0, 1),
          title: s.title ?? null,
          body: s.body ?? null,
          url: s.url ?? null,
          metadata: (s.metadata ?? undefined) as never,
        },
        update: {
          sentiment: clamp(s.sentiment, -1, 1),
          severity: clamp(s.severity, 0, 1),
          magnitude: clamp(s.magnitude ?? 0.5, 0, 1),
          title: s.title ?? null,
          body: s.body ?? null,
          metadata: (s.metadata ?? undefined) as never,
        },
      });
    }));
    n += chunk.length;
  }

  if (opts?.recompute !== false && inputs.length > 0) {
    const tenants = [...new Set(inputs.map((s) => s.tenantId))];
    await Promise.allSettled(tenants.map((t) => enqueueRecompute(t)));
  }
  return n;
}

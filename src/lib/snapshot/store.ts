// src/lib/snapshot/store.ts — VisibilitySnapshot persistence.
import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import type { AnswerRow } from "./run";
import type { SnapshotEngine, SnapshotPrompt, SnapshotReport, SnapshotStatus } from "./types";

/** A domain checked within this window is served from cache. */
export const CACHE_DAYS = 7;
/** A share link works this long after it was minted (or last re-minted). */
export const SHARE_DAYS = 30;
const DAY_MS = 86_400_000;

export interface SnapshotRow {
  id: string;
  brand: string;
  domain: string;
  category: string;
  location: string | null;
  locale: string;
  prompts: SnapshotPrompt[];
  engines: SnapshotEngine[];
  status: SnapshotStatus;
  report: SnapshotReport | null;
  costUsd: number;
  calls: number;
  error: string | null;
  shareToken: string | null;
  shareExpiresAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

type DbRow = Prisma.VisibilitySnapshotGetPayload<object>;

function toRow(r: DbRow): SnapshotRow {
  return {
    ...r,
    prompts: r.prompts as unknown as SnapshotPrompt[],
    engines: r.engines as SnapshotEngine[],
    status: r.status as SnapshotStatus,
    report: (r.report as unknown as SnapshotReport | null) ?? null,
    costUsd: Number(r.costUsd),
  };
}

export async function createSnapshot(data: {
  brand: string;
  domain: string;
  city: string | null;
  category: string;
  location: string | null;
  locale: string;
  prompts: SnapshotPrompt[];
  engines: SnapshotEngine[];
  ipHash: string;
}): Promise<SnapshotRow> {
  const r = await prisma.visibilitySnapshot.create({
    data: { ...data, prompts: data.prompts as unknown as Prisma.InputJsonValue },
  });
  return toRow(r);
}

export async function getSnapshot(id: string): Promise<SnapshotRow | null> {
  const r = await prisma.visibilitySnapshot.findUnique({ where: { id } });
  return r ? toRow(r) : null;
}

/** The newest run for this domain inside the cache window that has not failed. */
export async function findCached(domain: string, now = new Date()): Promise<SnapshotRow | null> {
  const r = await prisma.visibilitySnapshot.findFirst({
    where: { domain, status: { not: "failed" }, createdAt: { gte: new Date(now.getTime() - CACHE_DAYS * DAY_MS) } },
    orderBy: { createdAt: "desc" },
  });
  return r ? toRow(r) : null;
}

/** A live share link's run, or null when the token is unknown or expired. */
export async function getByShareToken(token: string, now = new Date()): Promise<SnapshotRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = await prisma.visibilitySnapshot.findUnique({ where: { shareToken: token } });
  if (!r || r.status !== "done" || !r.shareExpiresAt || r.shareExpiresAt < now) return null;
  return toRow(r);
}

export async function markRunning(id: string): Promise<void> {
  await prisma.visibilitySnapshot.update({ where: { id }, data: { status: "running" } });
}

export async function loadAnswers(id: string): Promise<AnswerRow[]> {
  const rows = await prisma.visibilitySnapshotAnswer.findMany({ where: { snapshotId: id } });
  return rows.map((r) => ({ ...r, engine: r.engine as SnapshotEngine, costUsd: Number(r.costUsd) }));
}

export async function saveAnswer(id: string, row: AnswerRow): Promise<void> {
  const data = {
    model: row.model,
    mentioned: row.mentioned,
    cited: row.cited,
    competitors: row.competitors,
    citedDomains: row.citedDomains,
    excerpt: row.excerpt,
    answer: row.answer,
    error: row.error,
    costUsd: new Prisma.Decimal(row.costUsd.toFixed(6)),
  };
  await prisma.visibilitySnapshotAnswer.upsert({
    where: { snapshotId_promptIndex_engine: { snapshotId: id, promptIndex: row.promptIndex, engine: row.engine } },
    create: { snapshotId: id, promptIndex: row.promptIndex, engine: row.engine, ...data },
    update: data,
  });
}

export async function saveAnalysis(
  id: string,
  engine: SnapshotEngine,
  byPrompt: Map<number, { competitors: string[]; excerpt: string }>,
): Promise<void> {
  await prisma.$transaction(
    [...byPrompt.entries()].map(([promptIndex, { competitors, excerpt }]) =>
      prisma.visibilitySnapshotAnswer.update({
        where: { snapshotId_promptIndex_engine: { snapshotId: id, promptIndex, engine } },
        data: { competitors, excerpt },
      }),
    ),
  );
}

export async function finishSnapshot(id: string, report: SnapshotReport, costUsd: number, calls: number): Promise<void> {
  await prisma.visibilitySnapshot.update({
    where: { id },
    data: {
      status: "done",
      report: report as unknown as Prisma.InputJsonValue,
      costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
      calls,
      completedAt: new Date(),
      error: null,
    },
  });
}

export async function failSnapshot(id: string, error: string, costUsd?: number, calls?: number): Promise<void> {
  await prisma.visibilitySnapshot.update({
    where: { id },
    data: {
      status: "failed",
      error: error.slice(0, 500),
      completedAt: new Date(),
      ...(costUsd !== undefined ? { costUsd: new Prisma.Decimal(costUsd.toFixed(6)) } : {}),
      ...(calls !== undefined ? { calls } : {}),
    },
  });
}

/**
 * Record an email for this run and return the share token, minting it on the
 * first unlock. Each unlock pushes the expiry to SHARE_DAYS from now: the link
 * a visitor was just sent must not expire sooner than promised.
 */
export async function unlock(
  id: string,
  lead: { email: string; locale: string; marketingConsent: boolean },
  now = new Date(),
): Promise<{ token: string; leadId: string; expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + SHARE_DAYS * DAY_MS);
  return prisma.$transaction(async (tx) => {
    const run = await tx.visibilitySnapshot.findUniqueOrThrow({ where: { id } });
    const token = run.shareToken ?? randomBytes(18).toString("base64url");
    await tx.visibilitySnapshot.update({ where: { id }, data: { shareToken: token, shareExpiresAt: expiresAt } });
    const l = await tx.visibilitySnapshotLead.upsert({
      where: { snapshotId_email: { snapshotId: id, email: lead.email } },
      create: { snapshotId: id, ...lead },
      update: { locale: lead.locale, marketingConsent: lead.marketingConsent },
    });
    return { token, leadId: l.id, expiresAt };
  });
}

export async function getLead(leadId: string) {
  return prisma.visibilitySnapshotLead.findUnique({ where: { id: leadId }, include: { snapshot: true } });
}

export async function markLeadEmailed(leadId: string): Promise<void> {
  await prisma.visibilitySnapshotLead.update({ where: { id: leadId }, data: { emailedAt: new Date() } });
}

/** Admin list: newest runs with their lead counts. */
export async function listForAdmin(take = 200) {
  const runs = await prisma.visibilitySnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      brand: true,
      domain: true,
      status: true,
      costUsd: true,
      calls: true,
      error: true,
      createdAt: true,
      completedAt: true,
      _count: { select: { leads: true } },
    },
  });
  return runs.map((r) => ({ ...r, costUsd: Number(r.costUsd), leads: r._count.leads }));
}

/** The admin list narrowed to the last `days` days. */
export function recentSince<T extends { createdAt: Date }>(runs: T[], days: number, now = new Date()): T[] {
  const since = now.getTime() - days * DAY_MS;
  return runs.filter((r) => r.createdAt.getTime() >= since);
}

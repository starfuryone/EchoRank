/**
 * scripts/answer-cache-hit-rate.ts — the shared answer cache's expected hit
 * rate, from the prompts that exist today. READ-ONLY: two SELECTs, no writes.
 *
 *   sudo -u echorank bash -c 'cd /opt/echorank/app && \
 *     NODE_OPTIONS=--conditions=react-server npx tsx scripts/answer-cache-hit-rate.ts'
 *
 * (react-server: src/lib/answer-cache.ts is `server-only`, and that condition
 * is how every non-Next runtime here resolves it — see CLAUDE.md.)
 *
 * Scheduled tracker: every active brand prompt (TrackedPrompt with a
 * brandProfileId) is asked once per engine per repetition per run day. Brand-
 * specific prompts are asked fresh; the rest share by normalized text. The
 * ratio below assumes every brand runs the same engines on the same day, so it
 * is the ceiling for a day on which everyone runs — Starter's weekly and
 * Growth's twice-weekly schedules lower it.
 *
 * Free check: each run's prompts on the day it was created, per engine,
 * over the last 30 days.
 *
 * The sidecar's tracked prompts (no brandProfileId) are not routed through
 * the cache and are reported separately, as what they would share.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { isBrandSpecific, normalizePrompt } from "@/lib/answer-cache";

type Tally = { asks: number; shared: number; brandSpecific: number; keys: Set<string> };
const tally = (): Tally => ({ asks: 0, shared: 0, brandSpecific: 0, keys: new Set() });

function line(label: string, t: Tally) {
  const misses = t.brandSpecific + t.keys.size;
  const hits = t.asks - misses;
  const rate = t.asks ? ((hits / t.asks) * 100).toFixed(1) : "0.0";
  console.log(
    `${label.padEnd(34)} asks ${String(t.asks).padStart(6)}  brand-specific ${String(t.brandSpecific).padStart(5)}  ` +
      `distinct shared ${String(t.keys.size).padStart(5)}  hits ${String(hits).padStart(6)}  hit rate ${rate}%`,
  );
}

async function main() {
  // ── Tracker and tracked prompts ──
  const prompts = await prisma.trackedPrompt.findMany({
    where: { active: true },
    select: {
      text: true,
      brandProfileId: true,
      brandProfile: { select: { name: true, aliases: true, competitors: true, website: true } },
      tenant: { select: { name: true } },
    },
  });
  const tracker = tally();
  const sidecar = tally();
  for (const p of prompts) {
    const t = p.brandProfileId ? tracker : sidecar;
    const names = p.brandProfile
      ? [p.brandProfile.name, ...p.brandProfile.aliases, ...p.brandProfile.competitors]
      : [p.tenant?.name ?? ""];
    t.asks += 1;
    if (isBrandSpecific(p.text, { names, domains: [p.brandProfile?.website] })) t.brandSpecific += 1;
    else t.keys.add(normalizePrompt(p.text));
  }

  // ── Free checks, last 30 days ──
  const since = new Date(Date.now() - 30 * 86_400_000);
  const runs = await prisma.visibilitySnapshot.findMany({
    where: { createdAt: { gte: since } },
    select: { brand: true, domain: true, prompts: true, engines: true, createdAt: true },
  });
  const free = tally();
  for (const run of runs) {
    const day = run.createdAt.toISOString().slice(0, 10);
    const list = Array.isArray(run.prompts) ? (run.prompts as Array<{ text?: string }>) : [];
    for (const engine of run.engines) {
      for (const prompt of list) {
        if (!prompt?.text) continue;
        free.asks += 1;
        if (isBrandSpecific(prompt.text, { names: [run.brand], domains: [run.domain] })) free.brandSpecific += 1;
        else free.keys.add(`${day}|${engine}|${normalizePrompt(prompt.text)}`);
      }
    }
  }

  console.log("Shared answer cache — expected hit rate from existing prompts\n");
  line("Scheduled tracker (one run day)", tracker);
  line("Free checks (last 30 days)", free);
  line("Sidecar tracked prompts (not cached)", sidecar);
  console.log(`\n${runs.length} free checks, ${prompts.length} active prompts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * scripts/analysis-agreement.ts — how far the heuristic analysis pass agrees
 * with the model ranking pass it replaces, on stored answers. READ-ONLY and
 * FREE: the model's verdicts are the ones already stored (MentionAnalysis
 * sentiment and recommendationPosition, CompetitorMention names), so no model
 * is called. An answer the lexicon is unsure about is counted as "would ask
 * the model", not compared.
 *
 *   sudo -u echorank bash -c 'cd /opt/echorank/app && \
 *     NODE_OPTIONS=--conditions=react-server npx tsx scripts/analysis-agreement.ts [N]'
 *
 * (react-server: @/lib/prisma is `server-only`; without the condition the
 * script dies at import — see CLAUDE.md.)
 *
 * N defaults to 200: the most recent OK runs that have a stored answer and a
 * stored ranking-pass result. Run it BEFORE the heuristic pass has written
 * rows over them (i.e. against runs analysed with the old path), or set
 * AI_ANALYSIS_MODE=llm in the workers until it has been run.
 *
 * Also prints the last 30 days' analysed answers per day, which is the number
 * of analysis calls the old path made per day — the calls this one avoids,
 * less the unsure share.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { brandAliases, type BrandContext } from "@/lib/ai-monitor/analysis/analyze-response";
import { analyseDeterministic } from "@/lib/ai-monitor/analysis/deterministic";
import { resolveEntities } from "@/lib/ai-monitor/analysis/entities";
import { extractEntitiesHeuristic, lexiconTone } from "@/lib/ai-monitor/analysis/heuristic";
import { matchesAlias } from "@/lib/ai-monitor/analysis/similarity";

async function main() {
  const n = Number(process.argv[2] ?? 200) || 200;
  const rows = await prisma.mentionAnalysis.findMany({
    where: { promptRun: { status: "OK", rawResponse: { not: null }, checkupId: { not: null } } },
    orderBy: { createdAt: "desc" },
    take: n,
    select: {
      sentiment: true,
      recommendationPosition: true,
      quarantinedAt: true,
      promptRun: {
        select: {
          rawResponse: true,
          competitorMentions: { select: { name: true } },
          checkup: { select: { brandProfile: { select: { name: true, aliases: true, competitors: true, website: true } } } },
        },
      },
    },
  });

  let compared = 0;
  let positionAgree = 0;
  let toneCompared = 0;
  let toneAgree = 0;
  let unsure = 0;
  let precisionHits = 0;
  let precisionTotal = 0;
  let recallHits = 0;
  let recallTotal = 0;

  for (const row of rows) {
    const profile = row.promptRun.checkup?.brandProfile;
    const answer = row.promptRun.rawResponse ?? "";
    if (!profile || !answer || row.quarantinedAt) continue;
    const brand: BrandContext = {
      brand: profile.name,
      domain: profile.website,
      brandVariations: profile.aliases,
      competitors: profile.competitors,
    };
    const aliases = brandAliases(brand);
    const names = [brand.brand, ...brand.brandVariations];
    const det = analyseDeterministic(answer, { names, domain: brand.domain, competitors: brand.competitors ?? [] });
    const entities = extractEntitiesHeuristic(answer, [...aliases, ...(brand.competitors ?? [])]);
    const resolved = resolveEntities(entities, aliases);
    const tone = lexiconTone(answer, names, det.listPosition !== null);
    compared += 1;

    if (resolved.brandPosition === row.recommendationPosition) positionAgree += 1;

    // Stored sentiment is lowercased and null for NOT_MENTIONED (toStoredSentiment).
    const stored = row.sentiment ? row.sentiment.toUpperCase() : "NOT_MENTIONED";
    if (tone.sentiment === null) unsure += 1;
    else {
      toneCompared += 1;
      if (tone.sentiment === stored) toneAgree += 1;
    }

    const modelNames = row.promptRun.competitorMentions.map((c) => c.name);
    const ours = resolved.competitors.map((c) => c.name);
    precisionTotal += ours.length;
    precisionHits += ours.filter((name) => modelNames.some((m) => matchesAlias(name, [m]))).length;
    recallTotal += modelNames.length;
    recallHits += modelNames.filter((m) => ours.some((name) => matchesAlias(m, [name]))).length;
  }

  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "n/a");
  console.log(`Heuristic vs model ranking pass, ${compared} stored answers\n`);
  console.log(`brand position (exact, incl. both unranked)  ${pct(positionAgree, compared)}`);
  console.log(`tone, where the lexicon was sure             ${pct(toneAgree, toneCompared)}  (${toneCompared} answers)`);
  console.log(`tone unsure -> would ask the model           ${pct(unsure, compared)}  (${unsure} answers)`);
  console.log(`competitors: precision                       ${pct(precisionHits, precisionTotal)}`);
  console.log(`competitors: recall                          ${pct(recallHits, recallTotal)}`);

  const since = new Date(Date.now() - 30 * 86_400_000);
  const recent = await prisma.mentionAnalysis.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const perDay = new Map<string, number>();
  for (const r of recent) {
    const day = r.createdAt.toISOString().slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const days = [...perDay.values()];
  const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
  const unsureShare = compared ? unsure / compared : 0;
  console.log(`\nanalysed answers per active day (30 d): ${avg.toFixed(1)} -> analysis calls avoided per day ~${(avg * (1 - unsureShare)).toFixed(1)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

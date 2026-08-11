/**
 * Re-run the entity classifier over stored competitor mentions.
 *
 * THE POINT OF "STORE, DON'T DELETE": this costs nothing at a provider. Every
 * entity an answer named is on its run row with its raw context, so changing a
 * rule and re-judging is a pass over the database rather than another checkup.
 * Rows are updated in place with the new verdict AND the new classifierVersion,
 * so what a row was judged to be, and by which rules, stays recoverable.
 *
 *   npx tsx scripts/reclassify-competitors.ts [--apply]
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  CLASSIFIER_VERSION,
  classifyEntity,
  sentenceWindow,
} from "@/lib/ai-monitor/analysis/competitor-filter";

async function main() {
  const apply = process.argv.includes("--apply");

  const mentions = await prisma.competitorMention.findMany({
    where: { classifierVersion: { lt: CLASSIFIER_VERSION } },
    select: {
      id: true,
      name: true,
      recommendationPosition: true,
      promptRun: {
        select: {
          rawResponse: true,
          checkupId: true,
          prompt: { select: { category: true } },
        },
      },
    },
  });
  console.log(`${mentions.length} mentions below version ${CLASSIFIER_VERSION}`);
  if (mentions.length === 0) return;

  // Cross-prompt consistency: DISTINCT PROMPTS that ranked each entity.
  //
  // A groupBy on name counts MENTIONS, and with repetitions above 1 the same
  // prompt ranks the same entity several times — one question would look like a
  // consensus and could promote a stray tool to rival on its own. Deduped by
  // (entity, promptId) instead.
  const rankedRows = await prisma.competitorMention.findMany({
    where: { recommendationPosition: { not: null } },
    select: { name: true, promptRun: { select: { promptId: true } } },
  });
  const promptsByEntity = new Map<string, Set<string>>();
  for (const row of rankedRows) {
    const key = row.name.trim().toLowerCase();
    const set = promptsByEntity.get(key) ?? new Set<string>();
    set.add(row.promptRun.promptId);
    promptsByEntity.set(key, set);
  }
  const rankedInPrompts = new Map(
    [...promptsByEntity].map(([name, prompts]) => [name, prompts.size]),
  );

  const counts: Record<string, number> = { RIVAL: 0, PLATFORM: 0, GENERIC: 0 };
  const examples: Record<string, string[]> = { RIVAL: [], PLATFORM: [], GENERIC: [] };

  for (const mention of mentions) {
    const result = classifyEntity(mention.name, {
      position: mention.recommendationPosition,
      context: sentenceWindow(mention.promptRun.rawResponse ?? "", mention.name),
      promptCategory: mention.promptRun.prompt.category,
      rankedInPrompts: rankedInPrompts.get(mention.name.toLowerCase()) ?? 0,
      categoryVocabulary: ["AI visibility", "AI visibility management"],
      brandName: "EchoRank360",
    });
    counts[result.classification] += 1;
    if (examples[result.classification].length < 8 && !examples[result.classification].includes(mention.name)) {
      examples[result.classification].push(mention.name);
    }
    if (apply) {
      await prisma.competitorMention.update({
        where: { id: mention.id },
        data: {
          classification: result.classification,
          classifierVersion: result.classifierVersion,
          // Prisma wants a JSON object shape; the trace is an array of them.
          classificationTrace: result.trace as unknown as object[],
        },
      });
    }
  }

  console.log(apply ? "APPLIED:" : "DRY RUN:");
  for (const key of ["RIVAL", "PLATFORM", "GENERIC"]) {
    console.log(`  ${key}: ${counts[key]}  e.g. ${examples[key].join(", ") || "-"}`);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

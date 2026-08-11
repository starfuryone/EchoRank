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

  // Cross-prompt consistency: how many distinct prompts ranked each entity.
  const ranked = await prisma.competitorMention.groupBy({
    by: ["name"],
    where: { recommendationPosition: { not: null } },
    _count: true,
  });
  const rankedInPrompts = new Map(ranked.map((r) => [r.name.toLowerCase(), r._count]));

  const counts: Record<string, number> = { RIVAL: 0, PLATFORM: 0, GENERIC: 0 };
  const examples: Record<string, string[]> = { RIVAL: [], PLATFORM: [], GENERIC: [] };

  for (const mention of mentions) {
    const result = classifyEntity(mention.name, {
      position: mention.recommendationPosition,
      context: sentenceWindow(mention.promptRun.rawResponse ?? "", mention.name),
      promptCategory: mention.promptRun.prompt.category,
      rankedInPrompts: rankedInPrompts.get(mention.name.toLowerCase()) ?? 0,
      categoryVocabulary: ["AI visibility", "AI visibility management"],
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
          classificationTrace: result.trace,
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

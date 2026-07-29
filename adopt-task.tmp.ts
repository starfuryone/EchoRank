import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { processSweep } from "@/infrastructure/queue/workers/serp-check.worker";

const TASK_ID = "07282241-2159-0066-0000-d33f5a303490";
const TENANT = "cmprqopn40001cs2xajbaix83";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const existing = await prisma.serpCheck.findUnique({ where: { dataforseoTaskId: TASK_ID } });
  const row = existing ?? (await prisma.serpCheck.create({
    data: {
      tenantId: TENANT, keyword: "reputation management software",
      locationCode: 2124, languageCode: "en", device: "desktop",
      dataforseoTaskId: TASK_ID, status: "queued", costUsd: 0.006,
      createdAt: new Date(Date.now() - 120_000),
    },
  }));
  console.log(`row ${row.id} status=${row.status}`);

  for (let i = 1; i <= 20; i++) {
    await processSweep();
    const after = await prisma.serpCheck.findUnique({ where: { id: row.id } });
    if (after && after.status !== "queued") {
      const items = (after.results as { items?: { position: number; domain: string; title: string }[] } | null)?.items ?? [];
      console.log("status  :", after.status, after.error ?? "");
      console.log("organic :", after.itemCount);
      console.log("features:", (after.serpFeatures as string[] | null)?.join(", "));
      for (const it of items.slice(0, 5)) console.log(`  ${it.position}. ${it.domain} — ${it.title}`);
      return;
    }
    console.log(`sweep ${i}/20 — still queued`);
    await sleep(30_000);
  }
  console.log("never completed");
}
main().catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(process.exitCode ?? 0); });

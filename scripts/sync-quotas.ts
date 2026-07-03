import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { planQuotaDefaults } from "@/lib/plan-config";

/** Re-align every tenant's quota row with its current planType.
 *  Run after any manual planType change (SQL flips bypass seeding). */
async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, planType: true },
  });
  for (const t of tenants) {
    const d = planQuotaDefaults(t.planType);
    if (!d) {
      console.log(`SKIP ${t.name} (${t.planType}): no defaults found`);
      continue;
    }
    await prisma.tenantQuota.upsert({
      where: { tenantId: t.id },
      update: { ...d },
      create: { tenantId: t.id, ...d },
    });
    console.log(
      `synced ${t.name} [${t.planType}] -> ai=${d.maxAiInferencesPerMonth}, email=${d.maxEmailsPerMonth}, monitoring=${d.maxMonitoringChecks}`,
    );
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });

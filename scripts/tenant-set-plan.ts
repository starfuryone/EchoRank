/**
 * Set a tenant's plan, billing status and quotas by hand, the way the Stripe
 * webhook does, in one transaction with an audit_logs row.
 *
 * Usage (as echorank or root: it reads the 600 .env, via dotenv below):
 *   cd /opt/echorank/app
 *   npm run tenant:set-plan -- --tenant test-agency --plan AGENCY                 # dry run
 *   npm run tenant:set-plan -- --tenant test-agency --plan AGENCY --apply         # write
 *   npm run tenant:set-plan -- --tenant acme --plan GROWTH --status ACTIVE --apply
 *
 * Refuses a tenant with a live Stripe subscription unless --force (Stripe owns
 * that plan). Prints the plan, status and every quota field before and after.
 * The logic and its rules: src/lib/tenant-set-plan.ts.
 *
 * Runtime strategy for `server-only` (CLAUDE.md): the npm script sets
 * --conditions=react-server, like `npm run workers`.
 */
import "dotenv/config";
import { prisma, disconnectPrisma } from "@/lib/prisma";
import { onPlanChange } from "@/lib/plan-change";
import { reconcileTenantMatrixAccounts } from "@/lib/matrix-accounts";
import { QUOTA_FIELDS, USAGE, parseSetPlanArgs, setTenantPlan, type Side } from "@/lib/tenant-set-plan";

function table(before: Side, after: Side): string {
  const rows: [string, string, string][] = [
    ["planType", before.planType, after.planType],
    ["billingStatus", before.billingStatus, after.billingStatus],
    ...QUOTA_FIELDS.map((f): [string, string, string] => [f, String(before.quotas?.[f] ?? "(no row)"), String(after.quotas?.[f] ?? "(no row)")]),
  ];
  const w = Math.max(...rows.map((r) => r[0].length));
  const b = Math.max(6, ...rows.map((r) => r[1].length));
  return [
    `  ${"field".padEnd(w)}  ${"before".padEnd(b)}  after`,
    ...rows.map(([k, x, y]) => `  ${k.padEnd(w)}  ${x.padEnd(b)}  ${y}${x === y ? "" : "   *"}`),
  ].join("\n");
}

async function main(): Promise<number> {
  const parsed = parseSetPlanArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`error: ${parsed.error}\n\n${USAGE}`);
    return 2;
  }
  const result = await setTenantPlan(parsed.args, {
    db: prisma,
    onPlanChange,
    reconcileMatrix: reconcileTenantMatrixAccounts,
  });
  if (!result.ok) {
    console.error(`refused: ${result.error}`);
    return 1;
  }
  const { tenant } = result;
  console.log(`tenant ${tenant.slug} (${tenant.name}, ${tenant.id})`);
  if (result.forced) console.log(`--force: live Stripe subscription ${result.activeSubscription} left as it is`);
  console.log(table(result.before, result.after));
  if (!result.applied) {
    console.log("\nDRY RUN: nothing written. Add --apply to write.");
    return 0;
  }
  console.log("\nAPPLIED in one transaction, with an audit_logs row (admin.tenant.set_plan).");
  if (result.effects.planChange) console.log(`plan change effects: ${JSON.stringify(result.effects.planChange)}`);
  if (result.effects.matrix) console.log(`matrix reconcile: ${JSON.stringify(result.effects.matrix)}`);
  for (const e of result.effects.errors) console.error(`warning: ${e}`);
  console.log("Running processes hold quotas in a 5-minute cache; they pick the new numbers up within 5 minutes.");
  return result.effects.errors.length ? 1 : 0;
}

main()
  .then(async (code) => {
    await disconnectPrisma();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err);
    await disconnectPrisma().catch(() => undefined);
    process.exit(1);
  });

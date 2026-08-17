/**
 * Grant, revoke and inspect domain-analysis credits, administratively.
 *
 * NO STRIPE. There is no checkout, no pack and no purchase path for this pool
 * yet — Phase 3 ships the ledger and the entitlement read, and the money comes
 * later. Until it does, this script is the ONLY way a credit enters the pool,
 * which is the same state watcher-solo-live.ts describes as "reachable only by
 * an administrative grant".
 *
 * ── EVERY GRANT NEEDS A UNIQUE REF ──────────────────────────────────────────
 *
 * The ledger is uniquely keyed (tenantId, reason, ref), which is what makes
 * every writer safe to retry. The consequence for an operator is that a second
 * grant with the same ref is a SILENT NO-OP, not a second grant — so this
 * script stamps a UTC timestamp into the default ref and refuses an empty one.
 * If you pass your own, make it unique per tenant or the grant you think you
 * made will not exist.
 *
 * ── BALANCE IS SUM(delta), ALWAYS ───────────────────────────────────────────
 *
 * There is no balance column and nothing here updates a row. A mistake is
 * corrected by granting a negative delta, which leaves both the mistake and the
 * correction in the audit trail. That is the point of an append-only ledger and
 * it is why `revoke` exists rather than a delete.
 *
 *   npx tsx scripts/keyword-opportunity-credits.ts balance <tenantId>
 *   npx tsx scripts/keyword-opportunity-credits.ts grant   <tenantId> <amount> [ref]
 *   npx tsx scripts/keyword-opportunity-credits.ts revoke  <tenantId> <amount> [ref]
 *   npx tsx scripts/keyword-opportunity-credits.ts history <tenantId>
 *
 * Must run as `echorank` or root — .env is 0600 and a run without it comes up
 * with no DATABASE_URL.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { creditBalance, creditHistory, grantCredits } from "@/lib/keyword-opportunity/credits";

function defaultRef(action: string): string {
  // Minute resolution: enough to make two grants on the same day distinct,
  // coarse enough that an operator re-running the same command inside a minute
  // is treated as the retry it almost certainly is.
  return `${action}-${new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "")}`;
}

async function main(): Promise<void> {
  const [command, tenantId, amountArg, refArg] = process.argv.slice(2);

  if (!command || !tenantId) {
    console.error("usage: keyword-opportunity-credits.ts <balance|grant|revoke|history> <tenantId> [amount] [ref]");
    process.exitCode = 1;
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planType: true },
  });
  if (!tenant) {
    console.error(`no tenant ${tenantId}`);
    process.exitCode = 1;
    return;
  }

  switch (command) {
    case "balance": {
      const balance = await creditBalance(tenantId);
      console.log(`${tenant.name} (${tenant.planType}): ${balance} domain-analysis credits`);
      return;
    }

    case "history": {
      const rows = await creditHistory(tenantId);
      if (rows.length === 0) {
        console.log("no ledger rows");
        return;
      }
      for (const row of rows) {
        const sign = row.delta > 0 ? "+" : "";
        console.log(`${sign}${row.delta}\t${row.reason}\t${row.ref}`);
      }
      console.log(`balance: ${await creditBalance(tenantId)}`);
      return;
    }

    case "grant":
    case "revoke": {
      const amount = Number(amountArg);
      if (!Number.isFinite(amount) || amount <= 0) {
        console.error("amount must be a positive integer; use `revoke` to take credits away");
        process.exitCode = 1;
        return;
      }
      const delta = command === "grant" ? Math.trunc(amount) : -Math.trunc(amount);
      const ref = (refArg ?? defaultRef(command)).trim();

      try {
        const balance = await grantCredits(tenantId, delta, ref);
        console.log(`${command} ${Math.abs(delta)} (ref ${ref}) -> balance ${balance}`);
      } catch (err) {
        // The commonest failure by far is a duplicate ref, and it is worth
        // naming: the row was NOT written and the balance did not move.
        console.error(
          `${command} failed — if the ref has been used for this tenant before, nothing was written: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        process.exitCode = 1;
      }
      return;
    }

    default:
      console.error(`unknown command ${command}`);
      process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

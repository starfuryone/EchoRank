/**
 * Send ONE rendered trial-ending email to an address you name.
 *
 *   npm run email:test-trial -- you@example.com
 *   npm run email:test-trial -- you@example.com --fr
 *   npm run email:test-trial -- you@example.com --annual --plan AGENCY
 *
 * ── WHAT IT IS FOR ─────────────────────────────────────────────────────────
 * Proving the relay works, end to end, from the box that will actually send —
 * credentials, sender reputation, whether Brevo accepts the message, and what
 * the thing looks like in a real inbox. Rendering is unit-tested; deliverability
 * cannot be.
 *
 * ── WHAT IT DOES NOT TOUCH ─────────────────────────────────────────────────
 * No database. It imports neither Prisma nor the queue: every value is invented
 * here, so there is no tenant to pick, no subscription to be mid-flight, and no
 * row this can write by accident. It also cannot mail a customer — the address
 * is the one you typed on the command line.
 *
 * ── IT REFUSES RATHER THAN HALF-SENDS ──────────────────────────────────────
 * isEmailConfigured() gates it. A relay with the host set and the credentials
 * blank fails inside Brevo with a message that reads like a code bug; failing
 * here instead names the variable that is missing.
 *
 * The dev guard is lifted deliberately (MAIL_ALLOW_DEV_SEND), because this
 * script's whole purpose is to put a real message in a real inbox from a box
 * where NODE_ENV is not "production". That is the one place in the tree where
 * lifting it is correct — see src/lib/mailer.ts.
 */

import "dotenv/config";

import type { PlanType } from "@/generated/prisma";
import { isEmailConfigured, mailFrom, missingEmailEnv, sendMail } from "@/lib/mailer";
import {
  BILLING_URL,
  renderTrialEndingEmail,
  type EmailLocale,
} from "@/lib/billing/trial-ending-email";

// Lift the dev guard for this process only. Placement is safe wherever it sits:
// isDryRun() reads the variable per call, not at import time. Set here, at the
// top of the module body, so it is impossible to miss when reading the file.
process.env.MAIL_ALLOW_DEV_SEND = "1";

const VALID_PLANS: PlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];

function usage(message: string): never {
  console.error(`\n${message}\n`);
  console.error("Usage: npm run email:test-trial -- <address> [--fr] [--annual] [--plan TIER]");
  console.error(`  --plan  one of: ${VALID_PLANS.join(", ")} (default GROWTH)`);
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const to = argv.find((a) => !a.startsWith("--"));
  if (!to) usage("An address is required.");
  // Deliberately loose: this is an operator typing their own inbox, and the
  // relay is the real validator. It catches the flag-only invocation, nothing more.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) usage(`"${to}" does not look like an address.`);

  const locale: EmailLocale = argv.includes("--fr") ? "fr" : "en";
  const interval = argv.includes("--annual") ? "year" : "month";

  const planArg = argv[argv.indexOf("--plan") + 1];
  const planType: PlanType = argv.includes("--plan")
    ? ((VALID_PLANS.find((p) => p === planArg?.toUpperCase()) ??
        usage(`--plan must be one of: ${VALID_PLANS.join(", ")}`)) as PlanType)
    : "GROWTH";

  if (!isEmailConfigured()) {
    console.error("\nSMTP is not configured — refusing to send.");
    console.error(`Missing or empty: ${missingEmailEnv().join(", ")}`);
    console.error("Set them in .env (see .env.example) and run this again.\n");
    process.exit(1);
  }

  // Fake but realistic: a trial that converts this time tomorrow, which is
  // exactly what the job would be firing about.
  const trialEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const { subject, html, text } = renderTrialEndingEmail({
    planType,
    interval,
    trialEndsAt,
    timezone: "America/Toronto",
    billingUrl: BILLING_URL,
    locale,
  });

  console.log(`from:     ${mailFrom()}`);
  console.log(`to:       ${to}`);
  console.log(`subject:  ${subject}`);
  console.log(`plan:     ${planType} (${interval}ly), locale ${locale}`);
  console.log("");
  console.log(text);
  console.log("");

  const sent = await sendMail({ to: [to], subject, html, text });
  if (!sent) {
    // Unreachable via the guard above unless SMTP_HOST went missing between the
    // check and the send; reported rather than swallowed.
    console.error("The mailer held the message — nothing was sent.");
    process.exit(1);
  }
  console.log(`Sent to ${to}.`);
}

main().catch((err) => {
  console.error("\nSend failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

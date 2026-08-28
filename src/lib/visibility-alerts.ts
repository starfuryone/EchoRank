import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { logger } from "@/infrastructure/observability/logger";
import {
  notifyPromptTransitions,
  notifyVisibilityAlert,
} from "@/lib/notifications/adapters";

/**
 * Direct SMTP alerting for visibility monitoring. Admin/owner alerts are not
 * customer-bound, and EmailDeliveryJob requires a customerId, so this bypasses
 * the email queue and sends through the shared Brevo relay.
 *
 * IT USED TO OWN A SECOND nodemailer TRANSPORT, byte-identical to the one in
 * src/lib/mailer.ts — two connection pools against one relay, and any change to
 * either applying to one sender and not the other. sendMail() is that transport
 * now. Behaviour here is unchanged: a false return still means "SMTP not
 * configured", still logs, and still returns rather than throwing.
 */

export interface BotFlip {
  bot: string;
  detail: string;
}

export interface VisibilityAlertInput {
  tenantId: string;
  url: string;
  prevScore: number;
  newScore: number;
  newGrade: string;
  flippedBlocked: BotFlip[];
  flippedAllowed: string[];
  failingChecks: { category: string; recommendation: string }[];
}

async function resolveRecipients(tenantId: string): Promise<string[]> {
  const members = await prisma.tenantMember.findMany({
    where: { tenantId },
    include: { user: { select: { email: true } } },
  });
  const elevated = members.filter((m) => m.role !== "MEMBER");
  const pool = elevated.length > 0 ? elevated : members;
  return Array.from(
    new Set(pool.map((m) => m.user.email).filter((e): e is string => !!e)),
  );
}

export async function sendVisibilityAlert(input: VisibilityAlertInput): Promise<void> {
  // Durable in-app record, written before the email is even attempted: this
  // alert had no storage of its own, so a tenant with no reachable recipients
  // (or no SMTP configured) used to lose it entirely. Additive — the email
  // below is unchanged and still sends.
  await notifyVisibilityAlert({
    tenantId: input.tenantId,
    url: input.url,
    prevScore: input.prevScore,
    newScore: input.newScore,
    newGrade: input.newGrade,
    blockedBots: input.flippedBlocked.map((f) => f.bot),
  });

  const recipients = await resolveRecipients(input.tenantId);
  if (recipients.length === 0) {
    logger.warn({ tenantId: input.tenantId, url: input.url }, "Visibility alert: no recipients");
    return;
  }

  const delta = input.newScore - input.prevScore;
  const subject =
    input.flippedBlocked.length > 0
      ? `[Echorank] AI crawler blocked on ${input.url}`
      : `[Echorank] AI visibility score dropped: ${input.prevScore} -> ${input.newScore} (${input.url})`;

  const lines: string[] = [
    `AI visibility change detected for ${input.url}`,
    ``,
    `Score: ${input.prevScore} -> ${input.newScore} (${delta >= 0 ? "+" : ""}${delta}), grade ${input.newGrade}`,
  ];
  if (input.flippedBlocked.length > 0) {
    lines.push(``, `Crawlers newly BLOCKED:`);
    for (const f of input.flippedBlocked) lines.push(`  - ${f.bot}: ${f.detail}`);
    lines.push(``, `If you never blocked these, check your CDN (Cloudflare AI Crawl Control / managed robots.txt).`);
  }
  if (input.flippedAllowed.length > 0) {
    lines.push(``, `Crawlers newly allowed: ${input.flippedAllowed.join(", ")}`);
  }
  if (input.failingChecks.length > 0) {
    lines.push(``, `Top recommendations:`);
    for (const c of input.failingChecks) lines.push(`  - ${c.category}: ${c.recommendation}`);
  }
  lines.push(``, `Details and re-run: https://echorank360.com/visibility`);
  const text = lines.join("\n");
  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.6">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;

  const sent = await sendMail({ to: recipients, subject, text, html });
  if (!sent) {
    logger.info({ tenantId: input.tenantId, recipients, subject }, "SMTP not configured - alert logged only");
    return;
  }
  logger.info({ tenantId: input.tenantId, recipients: recipients.length, url: input.url }, "Visibility alert sent");
}

// ─── Prompt mention alerts (answer tracking) ────────────────────────────────

export interface PromptTransition {
  promptId: string;
  promptText: string;
  kind: "visibility_lost" | "visibility_rank_drop" | "visibility_regained";
  prevRank: number | null;
  newRank: number | null;
}

/**
 * The English one-line summary of a transition. Shared by the AlertEvent row
 * and the in-app notification's fallback title so the two cannot drift; the
 * notification itself renders from its typed payload through the dashboard
 * catalogs, and only falls back to this string for an unknown type.
 */
function promptAlertTitle(t: PromptTransition): string {
  return t.kind === "visibility_lost"
    ? `No longer recommended: "${t.promptText.slice(0, 80)}"`
    : t.kind === "visibility_rank_drop"
      ? `Rank dropped #${t.prevRank} -> #${t.newRank}: "${t.promptText.slice(0, 80)}"`
      : `Recommended again: "${t.promptText.slice(0, 80)}"`;
}

/**
 * Persist AlertEvents for prompt mention transitions and send one digest
 * email per batch. dedupeKey is per prompt+kind+day, so retried batches
 * and overlapping sweeps cannot double-alert.
 */
export async function recordPromptAlerts(
  tenantId: string,
  transitions: PromptTransition[],
): Promise<void> {
  if (transitions.length === 0) return;

  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rows = transitions.map((t) => ({
    tenantId,
    kind: t.kind,
    severity: t.kind === "visibility_regained" ? "warning" : "critical",
    title: promptAlertTitle(t),
    body: null as string | null,
    dedupeKey: `vis-${t.kind}-${t.promptId}-${day}`,
    payload: { promptId: t.promptId, prevRank: t.prevRank, newRank: t.newRank },
  }));

  const created = await prisma.alertEvent.createMany({
    data: rows,
    skipDuplicates: true,
  });

  // In-app record, mirroring the AlertEvents above. Written before the
  // count/alertsEnabled early-returns below on purpose: those two suppress the
  // DIGEST EMAIL, and the durable in-app record is exactly what a tenant with
  // email alerts turned off is meant to read instead. Its own dedupeKey makes a
  // repeated sweep a no-op, so running this when created.count is 0 is free.
  await notifyPromptTransitions(tenantId, transitions, promptAlertTitle);

  if (created.count === 0) return; // everything already alerted today

  const cfg = await prisma.tenantRiskConfig.findUnique({ where: { tenantId } });
  if (cfg && !cfg.alertsEnabled) {
    logger.info({ tenantId, count: created.count }, "Prompt alerts stored; email disabled");
    return;
  }

  const recipients = await resolveRecipients(tenantId);
  if (recipients.length === 0) {
    logger.warn({ tenantId }, "Prompt alert digest: no recipients");
    return;
  }

  const lost = transitions.filter((t) => t.kind === "visibility_lost");
  const drops = transitions.filter((t) => t.kind === "visibility_rank_drop");
  const regained = transitions.filter((t) => t.kind === "visibility_regained");

  const subject =
    lost.length > 0
      ? `[Echorank] AI stopped recommending you for ${lost.length} prompt${lost.length > 1 ? "s" : ""}`
      : drops.length > 0
        ? `[Echorank] AI recommendation rank dropped on ${drops.length} prompt${drops.length > 1 ? "s" : ""}`
        : `[Echorank] AI is recommending you again (${regained.length} prompt${regained.length > 1 ? "s" : ""})`;

  const lines: string[] = [`AI recommendation changes detected in today's tracking run:`];
  if (lost.length > 0) {
    lines.push(``, `NO LONGER MENTIONED:`);
    for (const t of lost) lines.push(`  - "${t.promptText}"${t.prevRank ? ` (was #${t.prevRank})` : ""}`);
  }
  if (drops.length > 0) {
    lines.push(``, `RANK DROPPED:`);
    for (const t of drops) lines.push(`  - "${t.promptText}" #${t.prevRank} -> #${t.newRank}`);
  }
  if (regained.length > 0) {
    lines.push(``, `MENTIONED AGAIN:`);
    for (const t of regained) lines.push(`  - "${t.promptText}"${t.newRank ? ` (#${t.newRank})` : ""}`);
  }
  lines.push(``, `Trends and details: https://echorank360.com/visibility`);
  const text = lines.join("\n");
  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.6">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;

  const sent = await sendMail({ to: recipients, subject, text, html });
  if (!sent) {
    logger.info({ tenantId, recipients, subject }, "SMTP not configured - prompt digest logged only");
    return;
  }
  logger.info(
    { tenantId, recipients: recipients.length, lost: lost.length, drops: drops.length, regained: regained.length },
    "Prompt alert digest sent",
  );
}


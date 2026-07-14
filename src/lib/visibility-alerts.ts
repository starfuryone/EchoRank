import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";

/**
 * Direct SMTP alerting for visibility monitoring. Admin/owner alerts are not
 * customer-bound, and EmailDeliveryJob requires a customerId, so this bypasses
 * the email queue and sends via the same Brevo SMTP credentials.
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

let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (transport) return transport;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transport;
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
  const recipients = await resolveRecipients(input.tenantId);
  if (recipients.length === 0) {
    logger.warn({ tenantId: input.tenantId, url: input.url }, "Visibility alert: no recipients");
    return;
  }

  const delta = input.newScore - input.prevScore;
  const subject =
    input.flippedBlocked.length > 0
      ? `[EchoRank] AI crawler blocked on ${input.url}`
      : `[EchoRank] AI visibility score dropped: ${input.prevScore} -> ${input.newScore} (${input.url})`;

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

  const t = getTransport();
  if (!t) {
    logger.info({ tenantId: input.tenantId, recipients, subject }, "SMTP not configured - alert logged only");
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || "alerts@echorank360.com",
    to: recipients.join(", "),
    subject,
    text,
    html,
  });
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
    title:
      t.kind === "visibility_lost"
        ? `No longer recommended: "${t.promptText.slice(0, 80)}"`
        : t.kind === "visibility_rank_drop"
          ? `Rank dropped #${t.prevRank} -> #${t.newRank}: "${t.promptText.slice(0, 80)}"`
          : `Recommended again: "${t.promptText.slice(0, 80)}"`,
    body: null as string | null,
    dedupeKey: `vis-${t.kind}-${t.promptId}-${day}`,
    payload: { promptId: t.promptId, prevRank: t.prevRank, newRank: t.newRank },
  }));

  const created = await prisma.alertEvent.createMany({
    data: rows,
    skipDuplicates: true,
  });
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
      ? `[EchoRank] AI stopped recommending you for ${lost.length} prompt${lost.length > 1 ? "s" : ""}`
      : drops.length > 0
        ? `[EchoRank] AI recommendation rank dropped on ${drops.length} prompt${drops.length > 1 ? "s" : ""}`
        : `[EchoRank] AI is recommending you again (${regained.length} prompt${regained.length > 1 ? "s" : ""})`;

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

  const t = getTransport();
  if (!t) {
    logger.info({ tenantId, recipients, subject }, "SMTP not configured - prompt digest logged only");
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || "alerts@echorank360.com",
    to: recipients.join(", "),
    subject,
    text,
    html,
  });
  logger.info(
    { tenantId, recipients: recipients.length, lost: lost.length, drops: drops.length, regained: regained.length },
    "Prompt alert digest sent",
  );
}


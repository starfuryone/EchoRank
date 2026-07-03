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

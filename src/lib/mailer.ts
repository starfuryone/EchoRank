// src/lib/mailer.ts
//
// The ONE outbound SMTP path. Brevo's relay (smtp-relay.brevo.com), not Brevo's
// template API — the transactional-template integration is a separate concern
// and lives in src/lib/onboarding-email.ts.
//
// ONE TRANSPORT, ONE PLACE. This module used to be half of the story: a second,
// byte-identical `getTransport()` sat inline in src/lib/visibility-alerts.ts, so
// the process held two nodemailer pools against the same relay and a change to
// either (a timeout, a pool setting, a dev guard) silently applied to one sender
// and not the other. That copy is folded in here; every sender now goes through
// sendMail().
//
// TWO DIFFERENT QUESTIONS, AND THEY HAVE DIFFERENT ANSWERS:
//
//   getTransport()      — "can I open a connection at all?" Needs SMTP_HOST and
//                         nothing else, which is the behaviour the visibility
//                         alerts have always had and keep.
//   isEmailConfigured() — "is this relay actually set up to deliver mail to a
//                         customer?" Needs every SMTP_* variable. It is the gate
//                         for customer-facing mail, where a half-configured relay
//                         (host set, credentials blank) means Brevo refuses the
//                         message and the caller learns about it as a throw.
//
// The stricter check exists because the trial-ending notice is a money-path
// email: the card is charged whether or not the warning arrived, so "not
// configured" has to be a loud, single, structured log rather than an exception
// that poisons a BullMQ queue with retries it can never satisfy.

import nodemailer from "nodemailer";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "mailer" });

/** Every variable the relay needs to actually deliver. Order is the .env order. */
export const SMTP_ENV_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

/** Fallback sender, used when SMTP_FROM is unset. Pre-existing behaviour. */
const DEFAULT_FROM = "alerts@echorank360.com";

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

/**
 * Test seam. The transport is cached for the life of the process, which is
 * right in production and wrong in a suite that changes SMTP_* between cases.
 */
export function resetMailTransport(): void {
  transport = null;
}

/** The envelope sender. */
export function mailFrom(): string {
  return process.env.SMTP_FROM || DEFAULT_FROM;
}

/**
 * Whether the relay is fully configured — every SMTP_* variable present and
 * non-empty after trimming.
 *
 * EMPTY IS MISSING. `.env.example` ships `SMTP_USER=""`, so an operator who
 * copies it and fills in nothing has the variable defined and worthless; a
 * bare `process.env.SMTP_USER !== undefined` would call that configured and
 * hand Brevo a message it will reject.
 */
export function isEmailConfigured(): boolean {
  return SMTP_ENV_VARS.every((name) => (process.env[name] ?? "").trim().length > 0);
}

/** The SMTP_* variables that are missing or blank. For a diagnosable log line. */
export function missingEmailEnv(): string[] {
  return SMTP_ENV_VARS.filter((name) => (process.env[name] ?? "").trim().length === 0);
}

/**
 * The dev guard.
 *
 * A developer with a copy of the production .env should not be able to mail a
 * real customer by running a worker locally. Outside production, sendMail()
 * logs the message instead of delivering it.
 *
 * MAIL_ALLOW_DEV_SEND=1 is the deliberate escape hatch, and the operator smoke
 * script (scripts/email-test-trial.ts) is the reason it exists: its whole job is
 * to put one real message in a real inbox from a box where NODE_ENV is not
 * "production". MAIL_DRY_RUN=1 forces the guard on anywhere, production
 * included, for a rehearsal.
 */
export function isDryRun(): boolean {
  if (process.env.MAIL_DRY_RUN === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.MAIL_ALLOW_DEV_SEND !== "1";
}

export interface MailInput {
  to: string[];
  subject: string;
  html: string;
  /**
   * The plain-text alternative. Optional only because the pre-existing callers
   * predate it; every new sender should pass one. A message with no text part
   * scores worse with spam filters and is unreadable in a text-only client.
   */
  text?: string;
}

/**
 * Send one message through the shared Brevo relay.
 *
 * Returns false when there is nothing to send through — SMTP_HOST unset, or the
 * dev guard is holding the message — and true when nodemailer accepted it.
 * THROWS on a transport or relay error, which is deliberate: a caller running
 * inside BullMQ needs the rejection to trigger the retry, and a caller on a
 * request path is expected to wrap it (see src/lib/funnel/notify.ts).
 */
export async function sendMail({ to, subject, html, text }: MailInput): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;

  if (isDryRun()) {
    // WARN, not info: on a box where NODE_ENV is not "production" this
    // silently stops every customer email, including the trial-ending notice
    // that exists to precede a charge. That has to look different from a quiet
    // day in the logs.
    log.warn(
      { to, subject, dryRun: true, nodeEnv: process.env.NODE_ENV ?? null },
      "DRY RUN: email logged instead of sent (set MAIL_ALLOW_DEV_SEND=1 to send)",
    );
    return false;
  }

  await t.sendMail({
    from: mailFrom(),
    to: to.join(", "),
    subject,
    html,
    ...(text ? { text } : {}),
  });
  return true;
}

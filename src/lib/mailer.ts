import nodemailer from 'nodemailer';

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

export interface MailInput {
  to: string[];
  subject: string;
  html: string;
}

/** Shared Brevo SMTP relay. False if SMTP unconfigured; throws on transport error. */
export async function sendMail({ to, subject, html }: MailInput): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  await t.sendMail({
    from: process.env.SMTP_FROM || 'alerts@echorank360.com',
    to: to.join(', '),
    subject,
    html,
  });
  return true;
}

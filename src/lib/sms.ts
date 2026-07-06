/**
 * Brevo transactional SMS sender. Activation requires:
 *   BREVO_API_KEY        REST key (SMTP creds are NOT enough)
 *   BREVO_SMS_SENDER     alphanumeric sender name, max 11 chars
 * and purchased SMS credits on the Brevo account.
 */
export interface SmsResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export function smsConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SMS_SENDER);
}

export async function sendSms(to: string, content: string): Promise<SmsResult> {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER;
  if (!key || !sender) {
    return { ok: false, error: "SMS not configured (BREVO_API_KEY / BREVO_SMS_SENDER)" };
  }
  const recipient = to.replace(/[^\d+]/g, "");
  if (!/^\+?\d{8,15}$/.test(recipient)) {
    return { ok: false, error: `Invalid recipient: ${to}` };
  }
  const r = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": key },
    body: JSON.stringify({
      type: "transactional",
      sender,
      recipient,
      content: content.slice(0, 640),
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    return { ok: false, error: `Brevo ${r.status}: ${detail.slice(0, 200)}` };
  }
  const data = (await r.json()) as { messageId?: string | number };
  return { ok: true, messageId: String(data.messageId ?? "") };
}
// EOF-sms-lib

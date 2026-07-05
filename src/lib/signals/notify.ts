import { prisma } from './db';
import type { CreatedAlert } from './alerts';
import { sendMail } from '../mailer';

/**
 * Recipients: TenantRiskConfig.alertEmails (comma-separated, set in the
 * dashboard) → ALERT_FALLBACK_EMAIL env → none (events kept in-app only).
 * Sender: ALERT_FROM_EMAIL (default alerts@echorank360.com), via Brevo
 * (BREVO_API_KEY).
 */
async function resolveRecipients(tenantId: string): Promise<{ emails: string[]; enabled: boolean }> {
  const cfg = await prisma.tenantRiskConfig.findUnique({
    where: { tenantId },
    select: { alertEmails: true, alertsEnabled: true },
  });
  const raw: string = cfg?.alertEmails?.trim() || process.env.ALERT_FALLBACK_EMAIL || '';
  const emails = raw.split(',').map((e) => e.trim()).filter((e) => e.includes('@'));
  return { emails, enabled: cfg?.alertsEnabled ?? true };
}

async function tenantLabel(tenantId: string): Promise<string> {
  try {
    const t = await (prisma as unknown as {
      tenant: { findUnique(a: unknown): Promise<{ name?: string } | null> };
    }).tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    return t?.name ?? tenantId;
  } catch {
    return tenantId;
  }
}

function digestHtml(label: string, events: CreatedAlert[]): string {
  const rows = events
    .map(
      (e) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #27272a;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-family:monospace;
            background:${e.severity === 'critical' ? '#4c0519' : '#422006'};
            color:${e.severity === 'critical' ? '#fda4af' : '#fcd34d'};">${e.severity.toUpperCase()}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #27272a;color:#e4e4e7;font-size:14px;">
          ${e.title}${e.body ? `<div style="color:#a1a1aa;font-size:12px;margin-top:2px;">${e.body}</div>` : ''}
        </td>
      </tr>`,
    )
    .join('');
  return `<div style="background:#09090b;padding:24px;font-family:-apple-system,Segoe UI,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#18181b;border:1px solid #27272a;border-radius:8px;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid #27272a;">
        <div style="color:#2dd4bf;font-size:11px;letter-spacing:2px;font-family:monospace;">ECHORANK · REPUTATION INTELLIGENCE</div>
        <div style="color:#fafafa;font-size:16px;font-weight:600;margin-top:4px;">Risk alerts — ${label}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <div style="padding:14px 20px;">
        <a href="https://echorank360.com/intelligence/risk" style="color:#2dd4bf;font-size:13px;">Open the risk dashboard →</a>
      </div>
    </div>
  </div>`;
}

/**
 * One digest email per tenant per evaluation. Marks notifiedAt on success,
 * or on skip (alerts disabled / no recipients) so flushUnnotified doesn't
 * retry forever. Leaves notifiedAt null on transport failure → retried.
 */
export async function sendAlertDigest(tenantId: string, events: CreatedAlert[]): Promise<void> {
  if (!events.length) return;
  const ids = events.map((e) => e.id);
  const { emails, enabled } = await resolveRecipients(tenantId);

  const skip = async (reason: string) => {
    console.warn(`[signals] alert email skipped for ${tenantId}: ${reason}`);
    await prisma.alertEvent.updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() },
    });
  };

  if (!enabled) return skip('alerts disabled in config');
  if (!emails.length) return skip('no recipients (set alertEmails or ALERT_FALLBACK_EMAIL)');

  const label = await tenantLabel(tenantId);
  const worst = events.some((e) => e.severity === 'critical') ? 'CRITICAL' : 'Warning';

  try {
    const sent = await sendMail({
      to: emails,
      subject: `[${worst}] Reputation risk alert — ${label}`,
      html: digestHtml(label, events),
    });
    if (!sent) return skip('SMTP not configured (SMTP_HOST missing)');
    await prisma.alertEvent.updateMany({
      where: { id: { in: ids } },
      data: { notifiedAt: new Date() },
    });
    console.log(`[signals] alert digest sent to ${emails.length} recipient(s) for ${tenantId} (${events.length} events)`);
  } catch (err) {
    console.error('[signals] alert send failed:', (err as Error).message); // notifiedAt stays null → retried
  }
}

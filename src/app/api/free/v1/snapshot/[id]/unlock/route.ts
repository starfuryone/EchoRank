/**
 * POST /api/free/v1/snapshot/<id>/unlock { email, consent, locale } — the
 * email gate. Records the lead, mints (or extends) the 30-day share token,
 * queues the report email with the PDF, and returns the token plus the full
 * report so the page can open the prompt table at once.
 *
 * Marketing consent is a separate, unticked box: the report email is sent
 * either way (it is what was asked for); only consent adds the address to
 * the Brevo list.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/client-ip";
import { logger } from "@/infrastructure/observability/logger";
import { hashIp, takePrefillAllowance } from "@/lib/snapshot/limits";
import { getSnapshot, unlock } from "@/lib/snapshot/store";
import { enqueueSnapshotEmail } from "@/lib/snapshot/job";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.boolean().optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const run = /^[a-z0-9]{20,40}$/.test(id) ? await getSnapshot(id) : null;
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (run.status !== "done" || !run.report) return NextResponse.json({ error: "not_ready" }, { status: 409 });
  // Same per-IP budget as the prefill: unlocking sends mail, so it is not free to spam.
  if (!(await takePrefillAllowance(hashIp(getClientIp(request.headers))))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const locale = parsed.data.locale?.startsWith("fr") ? "fr" : "en";
  const { token, leadId, expiresAt } = await unlock(id, {
    email: parsed.data.email,
    locale,
    marketingConsent: parsed.data.consent === true,
  });
  try {
    await enqueueSnapshotEmail(leadId);
  } catch (err) {
    // The page still unlocks; the email is what failed, and the log says so.
    logger.error({ err, snapshotId: id, leadId }, "Snapshot report email could not be queued");
  }
  return NextResponse.json({ token, expiresAt: expiresAt.toISOString(), report: run.report });
}

// POST /api/partner/v1/audit — one AI-visibility audit. Contract: docs/agents/integrations.md, "Partner API (EchoPilot)".
import { handlePartnerPost } from "@/lib/partner/http";
import { partnerAudit } from "@/lib/partner/service";

export const maxDuration = 150;

export function POST(req: Request) {
  return handlePartnerPost(req, "audit", partnerAudit);
}

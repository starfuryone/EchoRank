// POST /api/partner/v1/visibility/query — the tracked-prompt answer check for one question.
import { handlePartnerPost } from "@/lib/partner/http";
import { partnerQuery } from "@/lib/partner/service";

export const maxDuration = 120;

export function POST(req: Request) {
  return handlePartnerPost(req, "query", partnerQuery);
}

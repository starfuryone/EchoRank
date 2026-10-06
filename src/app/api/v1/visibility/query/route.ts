// POST /api/v1/visibility/query — thin alias of /api/partner/v1/visibility/query.
// EchoPilot's client appends /v1/visibility/query to ECHORANK_API_BASE, and its
// .env still says https://echorank360.com/api. Same handler, same partner-scope
// auth; remove once every caller uses the /api/partner base.
import { handlePartnerPost } from "@/lib/partner/http";
import { partnerQuery } from "@/lib/partner/service";

export const maxDuration = 120;

export function POST(req: Request) {
  return handlePartnerPost(req, "query-alias", partnerQuery);
}

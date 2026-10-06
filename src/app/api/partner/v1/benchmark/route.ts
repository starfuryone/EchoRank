// POST /api/partner/v1/benchmark — quick audits of `you` and up to 5 competitors.
import { handlePartnerPost } from "@/lib/partner/http";
import { partnerBenchmark } from "@/lib/partner/service";

export const maxDuration = 150;

export function POST(req: Request) {
  return handlePartnerPost(req, "benchmark", partnerBenchmark);
}

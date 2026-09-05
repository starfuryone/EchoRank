// GET /api/public/v1/skills — the Echorank Agent Skills pack index.
//
// PUBLIC AND UNAUTHENTICATED, deliberately. These are documents: markdown
// workflows that tell an agent which Echorank MCP tools to call in what order.
// They contain no customer data and reveal nothing an API key would protect —
// the tool list they describe is already public on the MCP Server page and in
// `tools/list`. Requiring a key to read documentation would only mean an agent
// cannot fetch its instructions until after it is configured, which is exactly
// backwards.
//
// Read-only, and there is no POST: this endpoint has nothing to write to.
import { NextResponse } from "next/server";
import { agentSkillIndex } from "@/lib/agent-skills/loader";

/** Five minutes at the browser, an hour at the edge. The pack changes only on
 *  deploy, and a deploy is followed by a Cloudflare purge (CLAUDE.md). */
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

export function GET() {
  const skills = agentSkillIndex();
  return NextResponse.json(
    {
      skills: skills.map((skill) => ({
        ...skill,
        url: `/api/public/v1/skills/${skill.slug}`,
      })),
    },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}

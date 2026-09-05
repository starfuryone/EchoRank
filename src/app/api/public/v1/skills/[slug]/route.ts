// GET /api/public/v1/skills/<slug> — one SKILL.md, as raw markdown.
//
// Public and read-only for the same reason as the index beside it.
//
// THE SLUG IS MATCHED, NOT JOINED. `agentSkill()` looks the slug up in the
// already-loaded pack rather than building a filesystem path from it, so there
// is no path to traverse: `../../.env` simply is not in the set and 404s like
// any other unknown name. Never reintroduce a `join(dir, slug)` here.
import { NextResponse } from "next/server";
import { agentSkill } from "@/lib/agent-skills/loader";

const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const skill = agentSkill(slug);

  if (!skill) {
    return NextResponse.json({ error: "skill_not_found" }, { status: 404 });
  }

  // The frontmatter is part of the document — an agent installing this file
  // needs it — so the response is the file as written, reassembled rather than
  // re-read so the served bytes and the parsed metadata cannot disagree.
  const document = `---\nname: ${skill.name}\ndescription: "${skill.description}"\n---\n\n${skill.body}`;

  return new NextResponse(document, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
      // Served as a document, not a download, so it can be read in a browser;
      // an agent fetching it does not care either way.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

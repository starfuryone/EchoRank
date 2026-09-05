// src/lib/agent-skills/loader.ts
//
// Reads the Echorank Agent Skills pack — `.agents/skills/<name>/SKILL.md` —
// once per process, and hands it to the two surfaces that need it: the public
// route that serves the raw markdown, and the in-app assistant's system prompt.
//
// ── WHERE THE FILES COME FROM AT RUNTIME ───────────────────────────────────
// `process.cwd()`, which on this deployment is the repository itself: the box
// serves production from the working tree (CLAUDE.md, "Deploy"). That is what
// makes a filesystem read safe here where it would not be on a bundled,
// file-traced deployment. If Echorank is ever deployed as a standalone output
// or a container that ships only `.next`, this directory must be copied
// alongside it, or this loader must be replaced by a code-generation step —
// the failure would be an empty skills list, not a crash, so it would be quiet.
// `skillsDirectoryExists()` is exported so a health check can see it.
//
// ── LOADED ONCE, CACHED FOR THE PROCESS ────────────────────────────────────
// The pack is static: six files that change only on deploy, and this box
// restarts on every deploy. Re-reading them per request would be six file
// reads to render one page. The cache is deliberately not invalidatable —
// there is no correct moment to invalidate it that a restart does not already
// cover.
//
// ── A MALFORMED SKILL IS SKIPPED, NOT FATAL ────────────────────────────────
// One unparseable file must not take down the assistant's prompt assembly or
// return a 500 from a public route. It is logged and excluded, and
// `loadAgentSkills()` reports what it skipped so a test can assert the pack is
// clean. The test is where a broken skill should fail; production is not.

import "server-only";

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FrontmatterError, parseFrontmatter } from "./frontmatter";

/** Where the pack lives, relative to the repository root. */
export const SKILLS_DIR_SEGMENTS = [".agents", "skills"] as const;

const SKILL_FILE = "SKILL.md";

/** A slug is a directory name, and it becomes a URL segment. Keep it boring. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface AgentSkill {
  /** Directory name, and the id in a URL. */
  slug: string;
  /** Frontmatter `name`. Asserted equal to the slug — see loadAgentSkills. */
  name: string;
  /** Frontmatter `description`, one sentence. */
  description: string;
  /** The markdown after the frontmatter. */
  body: string;
  /** Bytes of the full file, for the page's download hint. */
  bytes: number;
}

export interface SkillLoadResult {
  skills: AgentSkill[];
  /** `${slug}: ${reason}` for each file that could not be used. */
  skipped: string[];
}

/**
 * The pack's directory.
 *
 * ── WHY THE turbopackIgnore COMMENT IS LOAD-BEARING ────────────────────────
 * Without it, Turbopack sees a filesystem read rooted at `process.cwd()` and
 * concludes the whole project might be needed at runtime. It then traces
 * EVERYTHING into every route that transitively imports this module — which
 * pulled `next.config.ts` and, through it, modules guarded by "server-only"
 * into the public skills route's graph, and failed the build with an error
 * naming a file that route never imports:
 *
 *   ./src/lib/dataforseo/client.ts
 *   ./src/lib/agent-skills/loader.ts
 *   ./src/app/api/public/v1/skills/[slug]/route.ts
 *
 * The comment tells Turbopack this path is deliberate and statically scoped,
 * which is true: it is a fixed two-segment path under the repository root, and
 * `agentSkill()` looks a slug up in the LOADED SET rather than joining caller
 * input onto it (see below), so nothing dynamic reaches the filesystem.
 */
function skillsDir(): string {
  return join(/* turbopackIgnore: true */ process.cwd(), ...SKILLS_DIR_SEGMENTS);
}

/** False on a deployment where the pack was not shipped. See the header. */
export function skillsDirectoryExists(): boolean {
  return existsSync(skillsDir());
}

function readPack(): SkillLoadResult {
  const dir = skillsDir();
  const skipped: string[] = [];

  if (!existsSync(dir)) {
    return { skills: [], skipped: [`${dir}: directory not present`] };
  }

  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const skills: AgentSkill[] = [];

  for (const slug of entries) {
    try {
      if (!SLUG_PATTERN.test(slug)) {
        throw new Error("directory name is not a lowercase-hyphen slug");
      }
      const path = join(dir, slug, SKILL_FILE);
      if (!existsSync(path)) throw new Error(`no ${SKILL_FILE}`);

      const source = readFileSync(path, "utf8");
      const { data, body } = parseFrontmatter(source);

      const name = data.name?.trim() ?? "";
      const description = data.description?.trim() ?? "";
      if (!name) throw new Error("frontmatter `name` is missing or empty");
      if (!description) throw new Error("frontmatter `description` is missing or empty");
      // The slug is what a URL and an install command carry; the name is what a
      // model reads. If they disagree, one of the two is wrong in a way nobody
      // notices until an agent asks for a skill by a name that 404s.
      if (name !== slug) {
        throw new Error(`frontmatter name "${name}" does not match directory "${slug}"`);
      }
      if (!body.trim()) throw new Error("body is empty");

      skills.push({
        slug,
        name,
        description,
        body,
        bytes: Buffer.byteLength(source, "utf8"),
      });
    } catch (err) {
      const reason =
        err instanceof FrontmatterError || err instanceof Error ? err.message : String(err);
      skipped.push(`${slug}: ${reason}`);
      console.error(`[agent-skills] skipping ${slug}: ${reason}`);
    }
  }

  return { skills, skipped };
}

let cache: SkillLoadResult | null = null;

/** The whole pack, plus anything that failed to load. Cached per process. */
export function loadAgentSkills(): SkillLoadResult {
  return (cache ??= readPack());
}

/** Just the usable skills, alphabetical by slug. */
export function agentSkills(): AgentSkill[] {
  return loadAgentSkills().skills;
}

/** One skill by slug, or null. The route's lookup — never build a path from
 *  caller input; this matches against the loaded set instead. */
export function agentSkill(slug: string): AgentSkill | null {
  return agentSkills().find((skill) => skill.slug === slug) ?? null;
}

/**
 * The `{name, description}` list, which is all a prompt or a page index needs.
 *
 * Separate from `agentSkills()` because the bodies are ~4 KB each and neither
 * caller wants 24 KB to render six lines.
 */
export function agentSkillIndex(): { slug: string; name: string; description: string }[] {
  return agentSkills().map(({ slug, name, description }) => ({ slug, name, description }));
}

/** Test seam: forget the cached pack so a suite can re-read the directory. */
export function __resetSkillCache(): void {
  cache = null;
}

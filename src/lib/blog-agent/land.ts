// src/lib/blog-agent/land.ts
//
// Writing the draft to disk and committing it.
//
// UMASK IS SET EXPLICITLY, not inherited. The workers process is started by
// pm2 under root and its umask is whatever pm2 was launched with — this is the
// Aug 18 bug class exactly: a file written 0640 by one account is a build that
// fails for the next, and here `echorank` has to read what `deploy` wrote or
// `next build` cannot see the article. Passing mode 0o644 on every write makes
// that independent of the process umask.
//
// COMMITS, NEVER PUSHES. This box has no push key by design, and `git ls-remote`
// fails, so a push would not merely fail — it would fail in a way the agent
// cannot distinguish from success. Frederic pushes from his laptop.

import "server-only";

import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "@/infrastructure/observability/logger";

const exec = promisify(execFile);

const REPO = process.cwd();
const CONTENT_DIR = join(REPO, "content", "blog", "en");
const PUBLIC_DIR = join(REPO, "public", "blog");

export interface LandInput {
  slug: string;
  /** Full file contents, frontmatter included. */
  markdown: string;
  /** The generated cover graphic. */
  heroSvg: string;
}

export interface LandResult {
  markdownPath: string;
  heroPath: string;
  committed: boolean;
  commitSha?: string;
}

/**
 * Run git in the repo.
 *
 * execFile, never a shell string: a slug reaching a shell is a command
 * injection, and although the slug is already constrained by the frontmatter
 * schema to `[a-z0-9-]`, that constraint living in a different file is not a
 * reason to build the unsafe version here.
 */
async function git(args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd: REPO, timeout: 30_000 });
  return stdout.trim();
}

/**
 * Write both files and commit them.
 *
 * ONE COMMIT PER ARTICLE, with only that article's two files staged by path.
 * `git commit -a` would sweep up whatever else is in the tree — and this tree
 * is production, so "whatever else" could be a half-finished edit somebody is
 * in the middle of. Staging by explicit path is the difference between an agent
 * that adds an article and an agent that commits someone's work-in-progress.
 */
export async function landDraft(input: LandInput): Promise<LandResult> {
  const heroDir = join(PUBLIC_DIR, input.slug);
  const markdownPath = join(CONTENT_DIR, `${input.slug}.md`);
  const heroPath = join(heroDir, "hero.svg");

  mkdirSync(CONTENT_DIR, { recursive: true, mode: 0o755 });
  mkdirSync(heroDir, { recursive: true, mode: 0o755 });

  writeFileSync(markdownPath, input.markdown, { encoding: "utf-8", mode: 0o644 });
  writeFileSync(heroPath, input.heroSvg, { encoding: "utf-8", mode: 0o644 });

  const relMarkdown = `content/blog/en/${input.slug}.md`;
  const relHero = `public/blog/${input.slug}/hero.svg`;

  try {
    await git(["add", "--", relMarkdown, relHero]);

    // Nothing staged means the files were byte-identical to what is already
    // committed — a re-run of the same slug. Committing nothing errors, so this
    // returns the write as done and the commit as skipped.
    const staged = await git(["diff", "--cached", "--name-only", "--", relMarkdown, relHero]);
    if (!staged) {
      return { markdownPath, heroPath, committed: false };
    }

    await git([
      "-c",
      "user.name=blog-agent",
      "-c",
      "user.email=fredericd@echorank360.com",
      "commit",
      "-m",
      `blog-agent: draft ${input.slug}`,
      "--only",
      "--",
      relMarkdown,
      relHero,
    ]);
    const commitSha = await git(["rev-parse", "--short", "HEAD"]);
    return { markdownPath, heroPath, committed: true, commitSha };
  } catch (err) {
    // The FILES ARE ALREADY ON DISK at this point, and that is the outcome that
    // matters — the article exists and the next build will pick it up. A failed
    // commit is reported and left for a human rather than treated as a reason
    // to delete the work.
    logger.error({ err, slug: input.slug }, "blog-agent: wrote draft but could not commit");
    return { markdownPath, heroPath, committed: false };
  }
}

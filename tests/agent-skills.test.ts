// The Echorank Agent Skills pack — the markdown workflows an external agent
// follows to drive the MCP server.
//
// These files are shipped documents, so the suite treats them as such: the
// parser is tested against literals, and the SHIPPED PACK is tested as content.
// A skill that names a tool the server does not expose, or that tells an agent
// to spend without checking the allowance first, is a broken document even
// though nothing about it fails to compile.

import { describe, expect, it } from "vitest";
import { parseFrontmatter, FrontmatterError } from "@/lib/agent-skills/frontmatter";
import { agentSkill, agentSkillIndex, loadAgentSkills } from "@/lib/agent-skills/loader";
import { MCP_TOOL_NAMES, MCP_WRITE_TOOLS } from "@/lib/mcp/tools";
import { RESEARCH_REUSE_WINDOW_DAYS } from "@/lib/research-log/types";

const { skills, skipped } = loadAgentSkills();

/** Every ` or `` fenced identifier in a skill body, e.g. `whoami`. */
function backtickedTokens(body: string): string[] {
  return [...body.matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]);
}

// ─── The parser ──────────────────────────────────────────────────────────────

describe("frontmatter parser", () => {
  it("reads bare, single-quoted and double-quoted values", () => {
    const { data, body } = parseFrontmatter(
      ['---', 'name: seo-audit', 'description: "One sentence: with a colon."', "other: 'quoted'", '---', '', '# Title', 'text'].join("\n"),
    );
    expect(data).toEqual({
      name: "seo-audit",
      description: "One sentence: with a colon.",
      other: "quoted",
    });
    expect(body).toBe("# Title\ntext");
  });

  it("tolerates CRLF, a BOM, blank lines and comments", () => {
    const { data } = parseFrontmatter(
      "﻿---\r\n# a comment\r\n\r\nname: x\r\n---\r\nbody\r\n",
    );
    expect(data).toEqual({ name: "x" });
  });

  it("refuses a file with no fence, an unclosed fence, or a duplicate key", () => {
    expect(() => parseFrontmatter("# no frontmatter")).toThrow(FrontmatterError);
    // Valid pairs, then end of file: the fence is genuinely unclosed. (A
    // stray non-pair line is rejected earlier, by the assertion below.)
    expect(() => parseFrontmatter("---\nname: x\n")).toThrow(/not closed/);
    expect(() => parseFrontmatter("---\nname: a\nname: b\n---\nx")).toThrow(/Duplicate/);
    expect(() => parseFrontmatter("---\nnot a pair\n---\nx")).toThrow(/key: value/);
  });
});

// ─── The shipped pack ────────────────────────────────────────────────────────

describe("shipped skills pack", () => {
  it("loads every skill, skipping none", () => {
    // The loader skips a malformed file rather than throwing, because one bad
    // skill must not 500 a public route or break the assistant's prompt. That
    // makes THIS the place a malformed skill has to fail.
    expect(skipped).toEqual([]);
    expect(skills.length).toBeGreaterThanOrEqual(6);
  });

  it("ships the six skills the pack is defined as", () => {
    expect(skills.map((s) => s.slug).sort()).toEqual([
      "ai-visibility-review",
      "backlinks-review",
      "keyword-research",
      "rank-tracking-setup",
      "seo-audit",
      "seo-coach",
    ]);
  });

  it("every skill has a name matching its directory and a real description", () => {
    for (const skill of skills) {
      expect(skill.name).toBe(skill.slug);
      expect(skill.description.length).toBeGreaterThan(30);
      // A description is a sentence a model reads to choose a skill. One word
      // is not a choice.
      expect(skill.description.split(/\s+/).length).toBeGreaterThan(6);
      expect(skill.body.trim().length).toBeGreaterThan(500);
    }
  });

  it("agentSkill() resolves by slug and refuses anything else", () => {
    expect(agentSkill("seo-coach")?.name).toBe("seo-coach");
    expect(agentSkill("nope")).toBeNull();
    // The route looks the slug up in the loaded set rather than joining it onto
    // a path. This asserts the traversal that would result has nowhere to go.
    expect(agentSkill("../../.env")).toBeNull();
    expect(agentSkill("../seo-coach")).toBeNull();
  });

  it("the index carries no bodies", () => {
    for (const entry of agentSkillIndex()) {
      expect(entry).not.toHaveProperty("body");
      expect(Object.keys(entry).sort()).toEqual(["description", "name", "slug"]);
    }
  });
});

// ─── Branding ────────────────────────────────────────────────────────────────

describe("branding", () => {
  it("never camel-cases the brand", () => {
    for (const skill of skills) {
      const text = `${skill.name} ${skill.description} ${skill.body}`;
      // CLAUDE.md: EchoRank / echoRank / Echo Rank are lint-level errors in
      // every surface a human or a crawler reads, and these are published at
      // /api/public/v1/skills.
      expect(text).not.toMatch(/EchoRank/);
      expect(text).not.toMatch(/echoRank/);
      expect(text).not.toMatch(/Echo Rank/);
    }
  });

  it("carries no OpenSEO branding", () => {
    for (const skill of skills) {
      const text = `${skill.description} ${skill.body}`;
      expect(text).not.toMatch(/OpenSEO/i);
      expect(text).not.toMatch(/open-seo/i);
      // Tools the reference has and Echorank does not. A skill naming one of
      // these was written from the wrong product's tool list.
      expect(text).not.toMatch(/\blist_projects\b|\bcreate_project\b/);
      expect(text).not.toMatch(/\bget_project_context\b|\bupdate_project_context\b/);
    }
  });

  it("names Echorank at least once, so an agent knows whose tools these are", () => {
    for (const skill of skills) {
      expect(`${skill.name} ${skill.body}`).toMatch(/Echorank/);
    }
  });
});

// ─── The content contract ────────────────────────────────────────────────────

describe("skills describe tools that actually exist", () => {
  it("every backticked snake_case token that looks like a tool IS a tool", () => {
    // The failure this catches is a skill telling an agent to call
    // `run_site_audit` — a real OpenSEO tool, and not one of ours. The agent
    // would try it, get -32602, and give up.
    const known = new Set<string>(MCP_TOOL_NAMES);
    // Field and argument names that legitimately appear in backticks.
    const allowed = new Set([
      "projectId",
      "target",
      "keyword",
      "keywords",
      "slug",
      "changed",
      "ignored",
      "feature",
      "whoami",
      "partial",
      "failedSections",
      "trackedKeywords",
    ]);
    for (const skill of skills) {
      for (const token of backtickedTokens(skill.body)) {
        if (!token.includes("_")) continue;
        if (allowed.has(token)) continue;
        expect(
          known.has(token),
          `${skill.slug} references \`${token}\`, which is not an Echorank MCP tool`,
        ).toBe(true);
      }
    }
  });
});

describe("spending discipline", () => {
  it("every skill tells the agent to call whoami", () => {
    for (const skill of skills) {
      expect(skill.body, `${skill.slug} must instruct calling whoami`).toMatch(/`whoami`/);
    }
  });

  it("every skill points at the research log and the 30-day reuse rule", () => {
    for (const skill of skills) {
      expect(
        skill.body,
        `${skill.slug} must reference get_research_log`,
      ).toMatch(/`get_research_log`|research log/i);
      // The window is a number in two places — the code and these documents —
      // so it is asserted rather than trusted.
      expect(
        skill.body,
        `${skill.slug} must state the ${RESEARCH_REUSE_WINDOW_DAYS}-day reuse window`,
      ).toMatch(new RegExp(`${RESEARCH_REUSE_WINDOW_DAYS}\\s*days`));
    }
  });

  it("a skill that names a spending tool also says it spends", () => {
    for (const skill of skills) {
      const mentionsWrite = MCP_WRITE_TOOLS.some((tool) => skill.body.includes(`\`${tool}\``));
      if (!mentionsWrite) continue;
      expect(
        skill.body,
        `${skill.slug} names a spending tool and must say so`,
      ).toMatch(/spend|cost|\$|allowance/i);
    }
  });

  it("no skill claims it can start an expensive analysis itself", () => {
    // The doctrine: backlinks, domain overview, KOF and site crawls are
    // started by a person on a page, never by an agent in a loop. A skill that
    // says otherwise is a bill waiting to happen.
    for (const skill of skills) {
      expect(skill.body).not.toMatch(/\brun_backlinks\b|\bstart_domain_overview\b|\bstart_crawl\b/);
    }
  });
});

// The queue wiring, the config, the hero generator and the publisher script.
//
// The centrepiece is the repeatable-schedule prune. That trap has already cost
// this codebase once — serp-check swept on a 60 s and a 30 s schedule
// simultaneously because BullMQ's repeat key includes the schedule, so changing
// it ADDS an entry rather than replacing one. The coercion that makes the prune
// correct (`every` arrives from Redis as a STRING) is asserted directly, because
// a test that went through Redis would not prove the coercion happened.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOG_AGENT_SCHEDULES,
  DISCOVER_CRON,
  DISCOVER_JOB,
  PUBLISH_CHECK_CRON,
  PUBLISH_CHECK_JOB,
  scheduleIsCurrent,
} from "@/infrastructure/queue/workers/blog-agent.worker";
import { QUEUE_NAMES, type QueueName } from "@/infrastructure/redis/config";
import {
  BlogAgentConfigError,
  DEFAULT_BLOG_AGENT_MODEL,
  DEFAULT_DAILY_USD,
  blogAgentApiKey,
  blogAgentDailyTarget,
  blogAgentDailyUsd,
  blogAgentEnabled,
  blogAgentMode,
  blogAgentModel,
  callCostUsd,
} from "@/lib/blog-agent/config";
import { renderHero } from "@/lib/blog-agent/hero";
import { BLOG_CATEGORIES } from "@/lib/blog/constants";

const ROOT = process.cwd();
const PUBLISHER = join(ROOT, "deploy", "blog-publisher");

/** Set env vars for one call and restore whatever was there. */
function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("queue registration", () => {
  it("registers blog-agent as a queue name", () => {
    expect(QUEUE_NAMES).toContain("blog-agent" as QueueName);
  });

  it("schedules discover before publish-check, both in UTC cron form", () => {
    expect(DISCOVER_CRON).toBe("0 5 * * *");
    expect(PUBLISH_CHECK_CRON).toBe("45 5 * * *");
    // Both must finish before the 06:15 publisher timer.
    const minutes = (cron: string) => Number(cron.split(" ")[1]) * 60 + Number(cron.split(" ")[0]);
    expect(minutes(DISCOVER_CRON)).toBeLessThan(minutes(PUBLISH_CHECK_CRON));
    expect(minutes(PUBLISH_CHECK_CRON)).toBeLessThan(6 * 60 + 15);
  });

  it("exposes the schedules it registers, so this suite reads the same source", () => {
    expect(BLOG_AGENT_SCHEDULES.map((s) => s.name)).toEqual([DISCOVER_JOB, PUBLISH_CHECK_JOB]);
  });
});

describe("the repeatable-schedule prune", () => {
  const want = { name: DISCOVER_JOB, cron: DISCOVER_CRON };

  it("keeps an entry that already matches", () => {
    expect(scheduleIsCurrent({ name: DISCOVER_JOB, pattern: DISCOVER_CRON }, want)).toBe(true);
  });

  it("removes an entry whose cron has changed", () => {
    expect(scheduleIsCurrent({ name: DISCOVER_JOB, pattern: "0 6 * * *" }, want)).toBe(false);
  });

  it("removes an interval entry even when the cron also matches", () => {
    // The swap case: an edit that moved this queue from an interval to a cron
    // leaves the interval entry behind, and the queue ticks on both.
    expect(scheduleIsCurrent({ name: DISCOVER_JOB, pattern: DISCOVER_CRON, every: 3_600_000 }, want)).toBe(false);
  });

  it("COERCES `every`, which Redis returns as a string", () => {
    // The actual bug: `entry.every !== 0` is true for the string "0", so a
    // schedule that was already correct gets deleted and re-added every restart.
    expect(scheduleIsCurrent({ name: DISCOVER_JOB, pattern: DISCOVER_CRON, every: "0" }, want)).toBe(true);
    expect(scheduleIsCurrent({ name: DISCOVER_JOB, pattern: DISCOVER_CRON, every: "3600000" }, want)).toBe(false);
  });

  it("treats a null `every` as no interval, which is how BullMQ types it", () => {
    expect(scheduleIsCurrent({ name: DISCOVER_JOB, pattern: DISCOVER_CRON, every: null }, want)).toBe(true);
  });

  it("never matches an entry belonging to another job", () => {
    expect(scheduleIsCurrent({ name: PUBLISH_CHECK_JOB, pattern: DISCOVER_CRON }, want)).toBe(false);
  });
});

describe("config", () => {
  it("is OFF unless explicitly enabled", () => {
    // An agent that writes files and spends money should require a yes, not
    // require a no.
    expect(withEnv({ BLOG_AGENT_ENABLED: undefined }, blogAgentEnabled)).toBe(false);
    expect(withEnv({ BLOG_AGENT_ENABLED: "" }, blogAgentEnabled)).toBe(false);
    expect(withEnv({ BLOG_AGENT_ENABLED: "yes" }, blogAgentEnabled)).toBe(false);
    expect(withEnv({ BLOG_AGENT_ENABLED: "true" }, blogAgentEnabled)).toBe(true);
  });

  it("defaults to review mode, and only the exact word auto changes it", () => {
    expect(withEnv({ BLOG_AGENT_MODE: undefined }, blogAgentMode)).toBe("review");
    expect(withEnv({ BLOG_AGENT_MODE: "AUTO" }, blogAgentMode)).toBe("auto");
    expect(withEnv({ BLOG_AGENT_MODE: "automatic" }, blogAgentMode)).toBe("review");
  });

  it("defaults to the cheapest model and lets an upgrade be a config change", () => {
    expect(withEnv({ BLOG_AGENT_MODEL: undefined }, blogAgentModel)).toBe(DEFAULT_BLOG_AGENT_MODEL);
    expect(DEFAULT_BLOG_AGENT_MODEL).toBe("claude-haiku-4-5");
    expect(withEnv({ BLOG_AGENT_MODEL: "claude-sonnet-5" }, blogAgentModel)).toBe("claude-sonnet-5");
  });

  it("names the missing variable when the key is absent, and never the value", () => {
    // The brief's rule: report the env var NAME. A thrown error carrying a
    // partial key would put a credential in a log line.
    expect(() => withEnv({ BLOG_AGENT_ANTHROPIC_KEY: undefined }, blogAgentApiKey)).toThrow(
      BlogAgentConfigError,
    );
    try {
      withEnv({ BLOG_AGENT_ANTHROPIC_KEY: undefined }, blogAgentApiKey);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as BlogAgentConfigError).envVar).toBe("BLOG_AGENT_ANTHROPIC_KEY");
      expect((err as Error).message).toContain("BLOG_AGENT_ANTHROPIC_KEY");
    }
  });

  it("does NOT fall back to the shared ANTHROPIC_API_KEY", () => {
    // A key shared across surfaces means one rotation takes Marketing Studio,
    // the assistant and the blog agent down together. The separate variable is
    // the whole point, so a silent fallback would defeat it.
    expect(() =>
      withEnv(
        { BLOG_AGENT_ANTHROPIC_KEY: undefined, ANTHROPIC_API_KEY: "sk-ant-something" },
        blogAgentApiKey,
      ),
    ).toThrow(BlogAgentConfigError);
  });

  it("FAILS on a malformed budget rather than silently using the default", () => {
    // "5o0" capping at fifty cents while someone believes it caps at five
    // dollars is worse than not starting.
    expect(withEnv({ BLOG_AGENT_DAILY_USD: undefined }, blogAgentDailyUsd)).toBe(DEFAULT_DAILY_USD);
    expect(withEnv({ BLOG_AGENT_DAILY_USD: "1.25" }, blogAgentDailyUsd)).toBe(1.25);
    expect(() => withEnv({ BLOG_AGENT_DAILY_USD: "5o0" }, blogAgentDailyUsd)).toThrow(BlogAgentConfigError);
    expect(() => withEnv({ BLOG_AGENT_DAILY_USD: "-1" }, blogAgentDailyUsd)).toThrow(BlogAgentConfigError);
  });

  it("bounds the daily target so a typo cannot order a hundred articles", () => {
    expect(withEnv({ BLOG_AGENT_DAILY_TARGET: undefined }, blogAgentDailyTarget)).toBe(3);
    expect(() => withEnv({ BLOG_AGENT_DAILY_TARGET: "100" }, blogAgentDailyTarget)).toThrow();
    expect(() => withEnv({ BLOG_AGENT_DAILY_TARGET: "0" }, blogAgentDailyTarget)).toThrow();
  });

  it("prices a call from the reported token counts", () => {
    // 1M in + 1M out at $1 / $5.
    expect(callCostUsd(1_000_000, 1_000_000)).toBeCloseTo(6, 6);
    // A realistic article: ~12k in, ~2.5k out. Comfortably inside the default cap.
    expect(callCostUsd(12_000, 2_500)).toBeLessThan(0.03);
  });
});

describe("hero generator", () => {
  it("produces valid-looking SVG for every category", () => {
    for (const category of BLOG_CATEGORIES) {
      const svg = renderHero({ slug: "a-test-slug", category });
      expect(svg, category).toMatch(/^<svg /);
      expect(svg, category).toContain('viewBox="0 0 1400 600"');
      expect(svg.trimEnd().endsWith("</svg>"), category).toBe(true);
    }
  });

  it("is DETERMINISTIC in the slug", () => {
    // Otherwise every nightly run rewrites every hero and produces a git diff
    // for no change.
    expect(renderHero({ slug: "same-slug", category: "Research" })).toBe(
      renderHero({ slug: "same-slug", category: "Research" }),
    );
  });

  it("varies the layout across slugs", () => {
    const svgs = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"].map(
      (slug) => renderHero({ slug, category: "Research" }),
    );
    expect(new Set(svgs).size).toBeGreaterThan(1);
  });

  it("escapes the eyebrow rather than interpolating it raw", () => {
    const svg = renderHero({ slug: "x", category: "Research & <Analysis>" });
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("<ANALYSIS>");
  });

  it("uses the Binance surface tokens, matching the hand-drawn heroes", () => {
    const svg = renderHero({ slug: "x", category: "GEO Guides" });
    expect(svg).toContain("#181A20");
    expect(svg).toContain("#1E2329");
  });
});

describe("publisher", () => {
  const script = join(PUBLISHER, "publish-blog.sh");

  it("ships the script and both systemd units", () => {
    for (const f of ["publish-blog.sh", "blog-publish.service", "blog-publish.timer", "README.md"]) {
      expect(existsSync(join(PUBLISHER, f)), f).toBe(true);
    }
  });

  it("is syntactically valid bash", () => {
    expect(() => execFileSync("bash", ["-n", script], { stdio: "pipe" })).not.toThrow();
  });

  it("supports --dry-run, and the dry run never builds or restarts", () => {
    const out = execFileSync("bash", [script, "--dry-run"], {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: "pipe",
    });
    expect(out).toMatch(/DRY RUN|nothing to do/);
    expect(out).not.toMatch(/pm2 restart/);
  });

  it("triggers only on PUBLISHED articles, never on a draft landing overnight", () => {
    // The whole point of review mode is that a draft sits until a human
    // promotes it. A build triggered by any changed file would defeat it.
    const body = readFileSync(script, "utf-8");
    expect(body).toContain("^status: published");
  });

  it("fails fast and writes the marker only after verification", () => {
    const body = readFileSync(script, "utf-8");
    expect(body).toContain("set -Eeuo pipefail");
    // A marker written before the origin checks means a failed build is never
    // retried, because tomorrow's run sees nothing newer.
    const markerAt = body.lastIndexOf('touch "$MARKER"');
    expect(markerAt).toBeGreaterThan(body.indexOf("verify /en/blog"));
  });

  it("keeps the build-and-restart pair together", () => {
    const body = readFileSync(script, "utf-8");
    expect(body).toContain("npm run build");
    expect(body).toContain("pm2 restart echorank360-web");
    expect(body.indexOf("npm run build")).toBeLessThan(body.indexOf("pm2 restart echorank360-web"));
  });

  it("runs the build as echorank, because .env is 600 echorank", () => {
    const body = readFileSync(script, "utf-8");
    expect(body).toContain("sudo -u echorank");
    expect(body).toContain("chown -R echorank:echorank .next");
    expect(body).toContain("chown -R deploy:deploy .next");
  });

  it("does not widen deploy's sudoers", () => {
    // deploy's sudo is scoped to /usr/bin/pm2. Nothing here may assume more.
    const body = readFileSync(script, "utf-8");
    expect(body).not.toMatch(/visudo|\/etc\/sudoers/);
  });

  it("names a timer that does not collide with the existing units", () => {
    // echorank-web.service, echorank-workers.service and redis-echorank.service
    // exist; no timers do. Verified 2026-08-21.
    const timer = readFileSync(join(PUBLISHER, "blog-publish.timer"), "utf-8");
    expect(timer).toContain("Unit=blog-publish.service");
    expect(timer).toContain("OnCalendar=*-*-* 06:15:00 UTC");
    expect(timer).toContain("Persistent=true");
  });
});

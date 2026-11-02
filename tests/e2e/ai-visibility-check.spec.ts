// tests/e2e/ai-visibility-check.spec.ts
//
// The free AI Visibility Check end to end, in a real browser against a real
// server and workers process: form → result preview → email gate unlock →
// share link, and the rate limit serving the cached run.
//
// NEVER AGAINST PRODUCTION: it starts paid checks. Run it against a scratch
// stack whose engines point at a stub (OPENAI_BASE_URL, GEMINI_BASE_URL,
// TURNSTILE_VERIFY_URL) and whose Postgres and Redis are throwaway, with the
// site built using Cloudflare's always-pass Turnstile test site key
// (NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA). The stub
// answers name the brand on some prompts and cite checkatrade.com / yell.com.
//
//   E2E_BASE_URL=http://127.0.0.1:4517 NODE_PATH=/opt/echopilot/node_modules \
//   /opt/echopilot/node_modules/.bin/playwright test -c tests/e2e/playwright.config.ts ai-visibility-check

import { expect, test } from "playwright/test";

const BRAND = "Acme Plumbing";
const run = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test("form → result → email gate → share link", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto("/en/ai-visibility-check");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("See what AI says when customers ask.");
  await expect(page.getByText("Real ChatGPT and Gemini answers")).toBeVisible();
  // Under the form: what the check shows.
  await expect(page.getByRole("heading", { name: "What the check shows" })).toBeVisible();
  await expect(page.getByText("Where do the answers come from?")).toBeVisible();

  await page.getByLabel("Website").fill(`acme-${run}.co.uk`);
  await page.getByLabel("Business name").fill(BRAND);
  await page.getByLabel("What you do").fill("emergency plumber");
  await page.getByLabel("City (optional)").fill("Leeds");
  // The always-pass test key solves itself; give the widget time to post its token.
  await page.waitForFunction(() => !!document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value, null, {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Run the free check" }).click();

  await expect(page.getByTestId("snapshot-running")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("run")).toMatch(/^[a-z0-9]{20,40}$/);

  // Pre-email: the two mention rates and competitor names; no prompt table, no sources.
  const preview = page.getByTestId("snapshot-preview");
  await expect(preview).toBeVisible({ timeout: 90_000 });
  await expect(preview.getByText("ChatGPT", { exact: true })).toBeVisible();
  await expect(preview.getByText("Gemini", { exact: true })).toBeVisible();
  await expect(preview.getByText("Pipeworks Ltd")).toBeVisible();
  await expect(preview.getByText("DrainPro")).toBeVisible();
  // …and the count of sources, but no prompt table, no source names, no actions.
  await expect(preview.getByText(/\d+ sources cited across the answers/)).toBeVisible();
  await expect(preview.locator("table")).toHaveCount(0);
  await expect(preview.getByText("checkatrade.com")).toHaveCount(0);
  await expect(preview.getByText("What to do")).toHaveCount(0);

  // The gate.
  await preview.getByPlaceholder("Email").fill(`e2e-${run}@example.com`);
  await preview.getByRole("button", { name: "Email me the full report" }).click();
  const full = page.getByTestId("snapshot-full");
  await expect(full).toBeVisible();
  await expect(full.locator("table").first().locator("tbody tr")).toHaveCount(10);
  await expect(full.getByRole("cell", { name: "checkatrade.com" })).toBeVisible();
  await expect(full.getByText("YES").first()).toBeVisible();
  // Per cell: competitors and an expandable excerpt.
  await expect(full.getByText(/^Named: /).first()).toBeVisible();
  const excerpt = full.locator("details").first();
  await excerpt.locator("summary").click();
  await expect(excerpt.locator("p")).toContainText("Pipeworks Ltd");
  // Sources that decided the answers, then What to do with typed, actioned rows.
  await expect(full.getByRole("heading", { name: "Sources that decided the answers" })).toBeVisible();
  await expect(full.getByRole("columnheader", { name: "Competitors it supported" })).toBeVisible();
  await expect(full.getByRole("heading", { name: "What to do" })).toBeVisible();
  await expect(full.getByText("Claim your profile")).toBeVisible();
  await expect(full.getByText("Get listed")).toBeVisible();

  // The upsell goes to the plan picker, prefilled.
  const track = page.getByRole("link", { name: /Track these 10 prompts weekly/ }).first();
  await expect(track).toHaveAttribute("href", /\/en\/pricing\?track=10x2-weekly/);

  // The share link opens the full report on its own, noindex.
  const shareUrl = await full.getByRole("textbox", { name: "Share link" }).inputValue();
  expect(shareUrl).toMatch(/\/en\/ai-visibility-check\/r\/[A-Za-z0-9_-]{20,}$/);
  const shared = await context.newPage();
  await shared.goto(new URL(shareUrl).pathname);
  await expect(shared.getByRole("heading", { level: 1 })).toHaveText(`AI Visibility Check: ${BRAND}`);
  await expect(shared.getByRole("heading", { name: "What to do" })).toBeVisible();
  await expect(shared.locator("table").first().locator("tbody tr")).toHaveCount(10);
  await expect(shared.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // And the plan picker picks the plan that covers 10 × 2 × weekly.
  await shared.goto(await track.getAttribute("href").then((h) => h!));
  await expect(shared.getByTestId("track-fit")).toContainText("plan covers it");
});

test("over the IP limit, a checked domain still returns its cached run; a new one is refused", async ({ request, baseURL }) => {
  const headers = { origin: baseURL!, "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}` };
  const start = (domain: string) =>
    request.post("/api/free/v1/snapshot", {
      headers,
      data: { brand: BRAND, domain, category: "emergency plumber", turnstileToken: "e2e" },
    });
  const first = await start(`limit-${run}-0.co.uk`);
  expect(first.status()).toBe(202);
  const cachedId = (await first.json()).id;
  for (let i = 1; i < 3; i++) expect((await start(`limit-${run}-${i}.co.uk`)).status()).toBe(202);

  const over = await start(`limit-${run}-3.co.uk`);
  expect(over.status()).toBe(429);
  expect(await over.json()).toEqual({ error: "rate_limited" });

  const again = await start(`limit-${run}-0.co.uk`);
  expect(again.status()).toBe(200);
  expect(await again.json()).toMatchObject({ id: cachedId, cached: true });
});

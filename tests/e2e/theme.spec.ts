// tests/e2e/theme.spec.ts — the marketing default theme follows New York time
// (day 09:00–16:59), a stored toggle choice always wins, the first frame is
// already the final theme, and the header is themed in both. See
// tests/e2e/playwright.config.ts for how to run.
import { expect, test, type Page } from "playwright/test";

const NOON_NY = new Date("2026-07-15T16:00:00Z"); // 12:00 EDT
const EIGHT_PM_NY = new Date("2026-07-16T00:00:00Z"); // 20:00 EDT

async function open(page: Page, path: string, at: Date, stored?: "day" | "night") {
  await page.clock.install({ time: at });
  if (stored) {
    await page.addInitScript((v) => {
      try {
        localStorage.setItem("er-theme", v);
      } catch {}
    }, stored);
  }
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

const theme = (page: Page) =>
  page.evaluate(() => (document.documentElement.getAttribute("data-theme") === "day" ? "day" : "night"));

for (const path of ["/en", "/fr"]) {
  test.describe(path, () => {
    test("no stored choice: day at 12:00 NY, night at 20:00 NY", async ({ page }) => {
      await open(page, path, NOON_NY);
      expect(await theme(page)).toBe("day");
      await open(page, path, EIGHT_PM_NY);
      expect(await theme(page)).toBe("night");
    });

    test("stored night at 12:00 stays night; stored day at 20:00 stays day", async ({ browser }) => {
      const a = await browser.newPage();
      await open(a, path, NOON_NY, "night");
      expect(await theme(a)).toBe("night");
      const b = await browser.newPage();
      await open(b, path, EIGHT_PM_NY, "day");
      expect(await theme(b)).toBe("day");
    });

    test("the toggle still flips, persists, and wins on the next visit", async ({ page }) => {
      await open(page, path, NOON_NY);
      expect(await theme(page)).toBe("day");
      await page.locator("nav").getByRole("button", { name: /night|nuit/i }).first().click();
      expect(await theme(page)).toBe("night");
      expect(await page.evaluate(() => localStorage.getItem("er-theme"))).toBe("night");
      await page.reload({ waitUntil: "domcontentloaded" });
      expect(await theme(page)).toBe("night");
    });

    test("an open tab switches at 17:00 NY within a minute", async ({ page }) => {
      await open(page, path, new Date("2026-07-15T20:59:30Z")); // 16:59:30 EDT
      expect(await theme(page)).toBe("day");
      await page.clock.fastForward(60_000);
      await expect.poll(() => theme(page)).toBe("night");
    });

    test("no flash: the first frame is already the final theme", async ({ page }) => {
      // Capture the theme attribute AND the painted page background at the
      // first readystatechange (the body exists, nothing has hydrated), then
      // compare both with the settled page.
      await page.addInitScript(() => {
        document.addEventListener(
          "readystatechange",
          () => {
            const page = document.querySelector("body > *") ?? document.body;
            (window as { __first?: [string | null, string] }).__first ??= [
              document.documentElement.getAttribute("data-theme"),
              getComputedStyle(page).backgroundColor,
            ];
          },
          { once: true },
        );
      });
      await open(page, path, NOON_NY);
      await page.waitForLoadState("load");
      await page.waitForTimeout(1500);
      const first = await page.evaluate(() => (window as { __first?: [string | null, string] }).__first);
      const final = await page.evaluate(() => [
        document.documentElement.getAttribute("data-theme"),
        getComputedStyle(document.querySelector("body > *") ?? document.body).backgroundColor,
      ]);
      expect(first).toEqual(final);
      expect(final[0]).toBe("day");
    });
  });
}

test("/dashboard is not themed by the schedule", async ({ page }) => {
  await open(page, "/dashboard", NOON_NY);
  // Anonymous, so this lands on /login — also an app page, also untouched.
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBeNull();
});

for (const width of [360, 1280]) {
  for (const [name, at] of [
    ["day", NOON_NY],
    ["night", EIGHT_PM_NY],
  ] as const) {
    test(`header ${width}px ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, "/en", at);
      await page.waitForLoadState("load");
      const nav = page.locator("nav").first();
      await expect(nav).toHaveScreenshot(`header-${width}-${name}.png`);
    });
  }
}

// tests/e2e/playwright.config.ts
//
// Browser checks for the marketing theme (time-of-day default, header). Not
// part of `npm test`: vitest only collects *.test.ts, and these are *.spec.ts.
//
// Playwright is NOT a dependency of this app. Run with any Playwright 1.63
// runner against a server you started yourself, e.g. EchoPilot's install on
// this box:
//
//   E2E_BASE_URL=http://127.0.0.1:4517 \
//   NODE_PATH=/opt/echopilot/node_modules \
//   /opt/echopilot/node_modules/.bin/playwright test -c tests/e2e/playwright.config.ts
//
// Never point it at production while a stored theme matters: it writes
// localStorage only in its own throwaway browser contexts, but the clock is
// mocked per page and screenshots are compared against committed baselines.
import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Keep traces and failure artifacts out of the repo root.
  outputDir: process.env.E2E_OUTPUT_DIR ?? "/tmp/echorank-e2e-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" } },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4400",
    colorScheme: "dark",
    serviceWorkers: "block",
  },
});

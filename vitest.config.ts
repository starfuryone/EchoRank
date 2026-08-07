import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest owns tests/ only. The suites under src/**/__tests__ run on
// `node --test --import tsx` (see the test:* scripts in package.json) and are
// deliberately excluded here — they are DB-less config tests with a different
// harness, and picking them up makes a bare `vitest run` red for no reason.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // node by default; a suite that needs a document opts in with a
    // `@vitest-environment jsdom` docblock (see mega-nav.dom.test.tsx).
    // environmentMatchGlobs was the old way to do this and was removed in
    // Vitest 4 — it fails silently, leaving `document is not defined`.
    // Per-file is better anyway: the opt-in is visible in the file that needs it.
    environment: "node",
    setupFiles: ["tests/setup-dom.ts"],
    server: {
      deps: {
        // next-auth ships extensionless ESM imports ("next/server") that
        // Node's own resolver rejects. Inlining lets Vite resolve them.
        inline: ["next-auth", "@auth/core"],
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

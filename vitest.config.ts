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
      // `server-only` is a marker package: under Next's react-server condition
      // it resolves to an empty module, and everywhere else to one that THROWS
      // on import. Vitest is "everywhere else", so without this alias every
      // suite touching prisma, metering, discover or the DataForSEO client
      // dies at import with "cannot be imported from a Client Component".
      //
      // Aliasing to its own empty.js is the same thing Next does, not a
      // weakening of the guard: the guard's job is to fail the BUILD when a
      // Client Component imports a server module, and the build still does.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
});

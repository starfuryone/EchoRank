import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest owns tests/ only. The suites under src/**/__tests__ run on
// `node --test --import tsx` (see the test:* scripts in package.json) and are
// deliberately excluded here — they are DB-less config tests with a different
// harness, and picking them up makes a bare `vitest run` red for no reason.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
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

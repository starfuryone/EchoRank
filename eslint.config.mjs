import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma client (gitignored build artifact, not hand-written).
    "src/generated/**",
  ]),
  {
    // Dashboard pages fetch their initial data from API routes in a mount
    // effect (setLoading(true) -> fetch -> setState). That synchronous
    // setState trips set-state-in-effect; it's the intended client-fetch
    // pattern here, so the rule is scoped off for these pages rather than
    // littered with per-line disables.
    files: ["src/app/(dashboard)/**/page.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;

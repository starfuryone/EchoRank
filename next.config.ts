import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Production serves from `.next`. A verification build must never overwrite
// it under the running process, so `NEXT_DIST_DIR=.next-check npm run build`
// builds beside it. Unset, this is the default `.next`.
const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig: NextConfig = {
  distDir,
  typescript: {
    // The deploy builds into .next-build (scripts/deploy.sh). Its type check
    // must see only this build's generated types: tsconfig.json also includes
    // .next/types and the other dist dirs, whose validator.ts imports the
    // routes of an older build, so a deleted route failed the next deploy.
    // tsconfig.build.json explains; tests/build-tsconfig.test.ts guards it.
    tsconfigPath: distDir === ".next-build" ? "tsconfig.build.json" : "tsconfig.json",
  },
};

// Only wrap with Sentry's build plugin when a DSN is configured, so default
// (and local) builds are completely unaffected by Sentry tooling.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
    })
  : nextConfig;

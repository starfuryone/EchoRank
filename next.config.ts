import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Production serves from `.next`. A verification build must never overwrite
  // it under the running process, so `NEXT_DIST_DIR=.next-check npm run build`
  // builds beside it. Unset, this is the default `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

// Only wrap with Sentry's build plugin when a DSN is configured, so default
// (and local) builds are completely unaffected by Sentry tooling.
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
    })
  : nextConfig;

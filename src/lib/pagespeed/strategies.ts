// src/lib/pagespeed/strategies.ts
//
// The PSI strategy enum, isolated in a leaf module with NO Node imports.
//
// This exists because the client component needs the strategy list, and
// importing it from pagespeed/client.ts dragged that module's `./fixtures`
// dependency — and therefore `node:fs` — into the browser bundle, which fails
// the Turbopack build outright. Anything the client component can reach must
// stay free of Node built-ins.

export const PSI_STRATEGIES = ["mobile", "desktop"] as const;
export type PsiStrategy = (typeof PSI_STRATEGIES)[number];

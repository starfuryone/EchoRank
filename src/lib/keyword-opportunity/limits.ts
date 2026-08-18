// src/lib/keyword-opportunity/limits.ts
//
// Constants both sides of the client/server boundary need.
//
// ── WHY THIS FILE EXISTS, AND IT IS NOT TIDINESS ────────────────────────────
//
// WORKING_SET_LIMIT lived in ./discover.ts, and the Keyword Explorer's confirm
// dialog imported it from there to say "at most 100". That one value import
// pulled discover.ts into the browser bundle, and with it metering.ts ->
// prisma.ts -> pg (dns, fs, net, tls) and dataforseo/client.ts (node:fs).
// Eight Turbopack errors, a failed build, a cleared .next, and the site served
// nothing until the next successful build. A number the UI needs must not drag
// a database driver behind it.
//
// NOTHING MAY BE IMPORTED INTO THIS FILE. Not a type, not a helper. Its whole
// value is that it has no edges: any import here is a path back into the
// server graph, and the next person to add one will not see the outage it
// causes until the build breaks. Values only, no logic, no dependencies.

/**
 * Keywords carried forward into scoring, for both entry modes.
 *
 * A discovery run cuts its candidate pool to this; a seeded run refuses a
 * selection larger than it. The same hundred either way, because everything
 * downstream of the working set is shared and neither mode may hand it more
 * than it was built for.
 */
export const WORKING_SET_LIMIT = 100;

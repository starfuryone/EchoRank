// src/lib/free-tools/volatility-flag.ts
//
// The switch for the free SERP volatility basket. Dependency-free on purpose:
// the worker entry, the sampler and the API route all read it.
//
// Defaults to FALSE, like BLOG_AGENT_ENABLED. The basket is a daily DataForSEO
// spend nobody pays for, so polling needs someone to have said yes. While it is
// off the worker is not registered, its repeatable schedule is removed on boot,
// the sampler refuses to post, and the tool serves the last stored snapshot
// with an "Updates paused" line.

export function volatilityPollEnabled(): boolean {
  return process.env.VOLATILITY_POLL_ENABLED?.trim().toLowerCase() === "true";
}

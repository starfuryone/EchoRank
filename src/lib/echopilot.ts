// src/lib/echopilot.ts — our sister product EchoPilot, as Echorank promotes it.
//
// SOCIAL POSTING LIVES IN ECHOPILOT, NOT HERE (2026-11-08). Echorank does not
// schedule or publish social posts; the SEO Tools hub card "Social posting, by
// EchoPilot" links out to it. Every surface that names what EchoPilot does
// reads this file, so a fact about the other product is stated once.
//
// Dependency-free: the dashboard catalogs (read by Client Components), the
// pricing FAQ and the tool page all import it.

/**
 * The channels EchoPilot PUBLISHES to. Mirrors PUBLISH_CHANNELS in
 * /opt/echopilot/src/lib/publishing/config.ts. Adding a channel is one line
 * here; never list a channel EchoPilot does not publish to.
 */
export const ECHOPILOT_CHANNELS = ["Facebook", "LinkedIn"] as const;

/** EchoPilot's pricing page, tagged so EchoPilot can attribute the visit. */
export const ECHOPILOT_PRICING_URL =
  "https://echopilotlabs.com/pricing?utm_source=echorank&utm_medium=app&utm_campaign=social";

/**
 * EchoPilot's launch offer, as EchoPilot runs it (its src/lib/pricing.ts:
 * LAUNCH_PERCENT_OFF, LAUNCH_OFFER_ENDS). `lastDay` is a New York date; the
 * window closes at `endsAt`, after which no surface shows the line.
 */
export const ECHOPILOT_LAUNCH_OFFER = {
  percentOff: 50,
  lastDay: "2027-02-22",
  endsAt: "2027-02-23T00:00:00-05:00",
} as const;

/** The `target` a click on the hub's EchoPilot page is recorded under. */
export const ECHOPILOT_SOCIAL_TARGET = "echopilot_social";

/** Is EchoPilot's launch offer still open? */
export function echopilotLaunchOfferOpen(now: Date = new Date()): boolean {
  return now.getTime() < new Date(ECHOPILOT_LAUNCH_OFFER.endsAt).getTime();
}

/** "Facebook and LinkedIn" / "Facebook et LinkedIn" / "Facebook und LinkedIn". */
export function echopilotChannelList(locale: "en" | "fr" | "de-CH"): string {
  return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(ECHOPILOT_CHANNELS);
}

/** The offer's last day in the locale's long form, e.g. "February 22, 2027". */
export function echopilotOfferLastDay(locale: "en" | "fr" | "de-CH"): string {
  const [y, m, d] = ECHOPILOT_LAUNCH_OFFER.lastDay.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

// src/components/layout/coming-soon-badge.tsx
//
// The golden "Coming Soon" badge, shared by all three hubs.
//
// ── WHAT IT MEANS, AND WHY IT IS NOT "NEW" OR "LOCKED" ────────────────────
// A card carries this when its live operation is blocked on GOOGLE's approval
// — an OAuth consent-screen review, or admission to a Google API program — not
// on our build queue and not on the customer's plan. That is a third state,
// and it needed its own badge because the two that existed say the wrong thing:
//
//   NEW     invites a click on something that cannot complete
//   LOCKED  says "upgrade", and no amount of money fixes this one
//
// ── IT REPLACES, IT DOES NOT STACK ────────────────────────────────────────
// Every hub renders this INSTEAD of whatever badge the card would otherwise
// carry, while the flag is set. Two badges on one card is a card that has to
// be read twice, and the more urgent of the two is always this one.
//
// ── BADGE ONLY ────────────────────────────────────────────────────────────
// It changes nothing about routing or gating. A card that was clickable stays
// clickable; a card that was locked stays locked. Whether a Google-blocked
// surface should also stop being reachable is a product decision, and making
// it here — invisibly, inside a badge component — would be the wrong place to
// make it.
//
// Gold on dark ink: #F0B90B is 1.9:1 against white and unreadable as text, and
// 8.8:1 against #1E2329. Both are tokens in globals.css so the pairing cannot
// be split up by a caller.

import { COMING_SOON_COPY, type DashLocale } from "@/lib/i18n/dashboard";

export function ComingSoonBadge({ locale }: { locale: DashLocale }) {
  const copy = COMING_SOON_COPY[locale];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-brand-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-gold-ink"
      title={copy.reason}
    >
      {/* Same corner and size language as NewBadge — rounded-full, px-2 py-0.5,
          10px uppercase — so the two read as one family rather than as two
          designs that happen to share a row. */}
      <span aria-hidden="true">{copy.label}</span>
      {/* The visible label says only "Coming soon". A screen reader gets the
          reason, because "coming soon" on its own is the one thing this badge
          does NOT mean — the surface is built; Google has not approved it. */}
      <span className="sr-only">{copy.sr}</span>
    </span>
  );
}

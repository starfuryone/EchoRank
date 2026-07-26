/**
 * Decorative illustrations for the Competitors help modal. Pure inline SVG —
 * no new deps, colours from the Tailwind palette already used in the app
 * (blue/sky base + amber/emerald/rose/violet accents, slate-600 strokes).
 * All are rendered inside aria-hidden containers by HelpModal.
 */

const STROKE = "#475569"; // slate-600

/** Two storefronts side by side — you (blue) vs a competitor (rose). */
export function ArtStorefronts() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      <path
        d="M24 4l1.9 3.7 4.1.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.1-.6z"
        fill="#fbbf24" stroke={STROKE} strokeWidth="1" strokeLinejoin="round"
      />
      <rect x="8" y="26" width="32" height="26" rx="3" fill="#dbeafe" stroke={STROKE} strokeWidth="1.5" />
      <rect x="6" y="17" width="36" height="10" rx="4" fill="#3b82f6" stroke={STROKE} strokeWidth="1.5" />
      <rect x="13" y="19" width="5" height="6" rx="2" fill="#bfdbfe" />
      <rect x="30" y="19" width="5" height="6" rx="2" fill="#bfdbfe" />
      <rect x="19" y="37" width="10" height="15" rx="2" fill="#3b82f6" />
      <path
        d="M72 8l1.6 3.2 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
        fill="#fbbf24" stroke={STROKE} strokeWidth="1" strokeLinejoin="round"
      />
      <rect x="56" y="28" width="32" height="24" rx="3" fill="#fecdd3" stroke={STROKE} strokeWidth="1.5" />
      <rect x="54" y="19" width="36" height="10" rx="4" fill="#fb7185" stroke={STROKE} strokeWidth="1.5" />
      <rect x="61" y="21" width="5" height="6" rx="2" fill="#fecdd3" />
      <rect x="78" y="21" width="5" height="6" rx="2" fill="#fecdd3" />
      <rect x="67" y="38" width="10" height="14" rx="2" fill="#fb7185" />
    </svg>
  );
}

/** A business listing card with a map pin, under a magnifying glass. */
export function ArtSearch() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      <rect x="8" y="8" width="58" height="44" rx="6" fill="#ffffff" stroke={STROKE} strokeWidth="1.5" />
      <rect x="14" y="15" width="24" height="5" rx="2.5" fill="#93c5fd" />
      <rect x="14" y="26" width="38" height="4" rx="2" fill="#e5e7eb" />
      <rect x="14" y="34" width="30" height="4" rx="2" fill="#e5e7eb" />
      <path
        d="M54 13c3.3 0 6 2.7 6 6 0 4.4-6 10-6 10s-6-5.6-6-10c0-3.3 2.7-6 6-6z"
        fill="#34d399" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      <circle cx="54" cy="19" r="2" fill="#ffffff" />
      <line x1="74" y1="48" x2="87" y2="59" stroke={STROKE} strokeWidth="6.5" strokeLinecap="round" />
      <line x1="74" y1="48" x2="87" y2="59" stroke="#a78bfa" strokeWidth="4" strokeLinecap="round" />
      <circle cx="65" cy="39" r="12" fill="#bae6fd" fillOpacity="0.8" stroke={STROKE} strokeWidth="1.5" />
      <circle cx="65" cy="39" r="8.5" stroke="#38bdf8" strokeWidth="1.5" />
    </svg>
  );
}

/** A review speech bubble with three stars and a little "+" badge. */
export function ArtReviews() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      <path
        d="M17 12h54a9 9 0 019 9v14a9 9 0 01-9 9H44L32 56l2-12H17a9 9 0 01-9-9V21a9 9 0 019-9z"
        fill="#ffffff" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      <g fill="#fbbf24" stroke={STROKE} strokeWidth="1" strokeLinejoin="round">
        <path d="M27 20l1.9 3.7 4.1.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.1-.6z" />
        <path d="M45 20l1.9 3.7 4.1.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.1-.6z" />
        <path d="M63 20l1.9 3.7 4.1.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.1-.6z" />
      </g>
      <circle cx="80" cy="13" r="7.5" fill="#34d399" stroke={STROKE} strokeWidth="1.5" />
      <path d="M80 9.5v7M76.5 13h7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A calendar filling up with daily snapshots. */
export function ArtCalendar() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      <rect x="18" y="12" width="60" height="44" rx="7" fill="#ffffff" stroke={STROKE} strokeWidth="1.5" />
      <path d="M18 19a7 7 0 017-7h46a7 7 0 017 7v7H18z" fill="#3b82f6" stroke={STROKE} strokeWidth="1.5" />
      <rect x="30" y="7" width="4" height="9" rx="2" fill={STROKE} />
      <rect x="62" y="7" width="4" height="9" rx="2" fill={STROKE} />
      <g>
        <rect x="25" y="32" width="9" height="9" rx="2.5" fill="#34d399" />
        <path d="M27.5 36.5l1.8 1.8 3-3.2" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="38" y="32" width="9" height="9" rx="2.5" fill="#34d399" />
        <path d="M40.5 36.5l1.8 1.8 3-3.2" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="51" y="32" width="9" height="9" rx="2.5" fill="#fbbf24" />
        <rect x="64" y="32" width="9" height="9" rx="2.5" fill="#e5e7eb" />
        <rect x="25" y="45" width="9" height="9" rx="2.5" fill="#e5e7eb" />
        <rect x="38" y="45" width="9" height="9" rx="2.5" fill="#e5e7eb" />
        <rect x="51" y="45" width="9" height="9" rx="2.5" fill="#e5e7eb" />
        <rect x="64" y="45" width="9" height="9" rx="2.5" fill="#e5e7eb" />
      </g>
    </svg>
  );
}

/** Inline: a row of stars for the rating metric card. */
export function ArtStarsRow() {
  return (
    <svg viewBox="0 0 84 16" className="h-4 w-auto" fill="none">
      <g fill="#fbbf24" stroke={STROKE} strokeWidth="0.8" strokeLinejoin="round">
        <path d="M8 1l1.7 3.4 3.7.5-2.7 2.6.6 3.7L8 9.5l-3.3 1.7.6-3.7L2.6 4.9l3.7-.5z" />
        <path d="M25 1l1.7 3.4 3.7.5-2.7 2.6.6 3.7L25 9.5l-3.3 1.7.6-3.7-2.7-2.6 3.7-.5z" />
        <path d="M42 1l1.7 3.4 3.7.5-2.7 2.6.6 3.7L42 9.5l-3.3 1.7.6-3.7-2.7-2.6 3.7-.5z" />
        <path d="M59 1l1.7 3.4 3.7.5-2.7 2.6.6 3.7L59 9.5l-3.3 1.7.6-3.7-2.7-2.6 3.7-.5z" />
      </g>
      <path
        d="M76 1l1.7 3.4 3.7.5-2.7 2.6.6 3.7L76 9.5l-3.3 1.7.6-3.7-2.7-2.6 3.7-.5z"
        fill="#e5e7eb" stroke={STROKE} strokeWidth="0.8" strokeLinejoin="round"
      />
    </svg>
  );
}

/** Inline: the momentum "race" — a competitor's bar pulling ahead of yours. */
export function ArtRaceBar() {
  return (
    <svg viewBox="0 0 80 24" className="h-5 w-auto" fill="none">
      <rect x="2" y="3" width="62" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="2" y="3" width="26" height="7" rx="3.5" fill="#3b82f6" />
      <rect x="2" y="14" width="62" height="7" rx="3.5" fill="#e5e7eb" />
      <rect x="2" y="14" width="46" height="7" rx="3.5" fill="#fb7185" />
      <line x1="70" y1="2" x2="70" y2="22" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M70 3h8l-2.5 3.5L78 10h-8z" fill="#fbbf24" stroke={STROKE} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

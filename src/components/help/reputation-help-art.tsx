/**
 * Decorative illustrations for the Reputation Tools help modal. Pure inline SVG
 * — no new deps, colours from the Tailwind palette already used in the app
 * (blue/sky base + amber/emerald/rose accents, slate-600 strokes), matching
 * competitors-help-art.tsx. All are rendered inside aria-hidden containers by
 * HelpModal, so they carry no text and need no translation.
 */

const STROKE = "#475569"; // slate-600

/** The hub itself: one row of grouped cards replacing a long list. */
export function ArtHubGrid() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      {/* The old list, fading out on the left */}
      <rect x="4" y="10" width="20" height="3" rx="1.5" fill="#cbd5e1" />
      <rect x="4" y="17" width="20" height="3" rx="1.5" fill="#cbd5e1" />
      <rect x="4" y="24" width="20" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="4" y="31" width="20" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="4" y="38" width="20" height="3" rx="1.5" fill="#f1f5f9" />
      <rect x="4" y="45" width="20" height="3" rx="1.5" fill="#f1f5f9" />
      {/* Arrow into the grid */}
      <path d="M30 29h8m0 0-3-3m3 3-3 3" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Four grouped cards */}
      <rect x="46" y="10" width="20" height="16" rx="3" fill="#dbeafe" stroke={STROKE} strokeWidth="1.5" />
      <rect x="70" y="10" width="20" height="16" rx="3" fill="#dcfce7" stroke={STROKE} strokeWidth="1.5" />
      <rect x="46" y="32" width="20" height="16" rx="3" fill="#fef3c7" stroke={STROKE} strokeWidth="1.5" />
      <rect x="70" y="32" width="20" height="16" rx="3" fill="#fce7f3" stroke={STROKE} strokeWidth="1.5" />
      <rect x="50" y="15" width="12" height="2" rx="1" fill="#3b82f6" />
      <rect x="74" y="15" width="12" height="2" rx="1" fill="#22c55e" />
      <rect x="50" y="37" width="12" height="2" rx="1" fill="#f59e0b" />
      <rect x="74" y="37" width="12" height="2" rx="1" fill="#ec4899" />
    </svg>
  );
}

/** Customer → request → review landing on a platform. */
export function ArtRequestFlow() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      {/* Customer */}
      <circle cx="14" cy="24" r="6" fill="#dbeafe" stroke={STROKE} strokeWidth="1.5" />
      <path d="M5 44c0-5 4-8 9-8s9 3 9 8" fill="#dbeafe" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      {/* Request envelope */}
      <rect x="34" y="20" width="24" height="17" rx="2.5" fill="#eff6ff" stroke={STROKE} strokeWidth="1.5" />
      <path d="M34 22.5l12 8 12-8" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 28h5m0 0-2-2m2 2-2 2" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M61 28h5m0 0-2-2m2 2-2 2" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Review card with a star */}
      <rect x="69" y="16" width="23" height="25" rx="3" fill="#fffbeb" stroke={STROKE} strokeWidth="1.5" />
      <path
        d="M80.5 21l1.7 3.4 3.8.6-2.7 2.6.6 3.8-3.4-1.8-3.4 1.8.6-3.8-2.7-2.6 3.8-.6z"
        fill="#fbbf24" stroke={STROKE} strokeWidth="1" strokeLinejoin="round"
      />
      <rect x="73" y="34" width="15" height="2" rx="1" fill="#fcd34d" />
    </svg>
  );
}

/** A negative signal caught and routed to a person before it is published. */
export function ArtRecoveryCatch() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      {/* Unhappy signal */}
      <circle cx="16" cy="26" r="9" fill="#fee2e2" stroke={STROKE} strokeWidth="1.5" />
      <circle cx="13" cy="24" r="1.2" fill={STROKE} />
      <circle cx="19" cy="24" r="1.2" fill={STROKE} />
      <path d="M12.5 30.5c2-2 5-2 7 0" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
      {/* Catch net / shield */}
      <path
        d="M46 12l12 4v9c0 7-5 12-12 14-7-2-12-7-12-14v-9z"
        fill="#dbeafe" stroke={STROKE} strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M41 25.5l3.5 3.5 7-7" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 26h4m0 0-2-2m2 2-2 2" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M61 26h5m0 0-2-2m2 2-2 2" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Owner assigned */}
      <circle cx="79" cy="21" r="5.5" fill="#dcfce7" stroke={STROKE} strokeWidth="1.5" />
      <path d="M71 40c0-4.5 3.6-7 8-7s8 2.5 8 7" fill="#dcfce7" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M84 12l1.5 3 3 .5-2.2 2 .5 3-2.8-1.4-2.8 1.4.5-3-2.2-2 3-.5z" fill="#22c55e" stroke={STROKE} strokeWidth=".9" strokeLinejoin="round" />
    </svg>
  );
}

/** Several review sources aggregating into one score. */
export function ArtSourcesToScore() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      {/* Sources */}
      <rect x="4" y="8" width="18" height="12" rx="2.5" fill="#dbeafe" stroke={STROKE} strokeWidth="1.4" />
      <rect x="4" y="26" width="18" height="12" rx="2.5" fill="#fce7f3" stroke={STROKE} strokeWidth="1.4" />
      <rect x="4" y="44" width="18" height="12" rx="2.5" fill="#dcfce7" stroke={STROKE} strokeWidth="1.4" />
      {/* Converging lines */}
      <path d="M23 14h8c3 0 4 3 6 10M23 32h14M23 50h8c3 0 4-3 6-10" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M39 32h5m0 0-2-2m2 2-2 2" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Score dial */}
      <circle cx="70" cy="32" r="18" fill="#eff6ff" stroke={STROKE} strokeWidth="1.5" />
      <path d="M70 14a18 18 0 0 1 15.6 27" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="61" y="27" width="18" height="4" rx="2" fill="#3b82f6" />
      <rect x="64" y="35" width="12" height="3" rx="1.5" fill="#93c5fd" />
    </svg>
  );
}

/** A locked card and the upgrade that opens it. */
export function ArtPlanLock() {
  return (
    <svg viewBox="0 0 96 64" className="h-14 w-auto" fill="none">
      {/* Locked card */}
      <rect x="6" y="14" width="34" height="36" rx="4" fill="#f1f5f9" stroke={STROKE} strokeWidth="1.5" strokeDasharray="4 3" />
      <rect x="16" y="28" width="14" height="11" rx="2" fill="#cbd5e1" stroke={STROKE} strokeWidth="1.4" />
      <path d="M19 28v-3.5a4 4 0 0 1 8 0V28" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="23" cy="33.5" r="1.6" fill={STROKE} />
      {/* Arrow */}
      <path d="M45 32h7m0 0-3-3m3 3-3 3" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Unlocked card */}
      <rect x="57" y="14" width="34" height="36" rx="4" fill="#dcfce7" stroke={STROKE} strokeWidth="1.5" />
      <path d="M67 26.5l4.5 4.5 9-9" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="65" y="37" width="18" height="2.5" rx="1.25" fill="#86efac" />
      <rect x="65" y="42" width="12" height="2.5" rx="1.25" fill="#bbf7d0" />
    </svg>
  );
}

type Captions = {
  locations: string;
  standard: string;
  rollup: string;
};

export default function RollupGraphic({
  captions = {
    locations: "Every location",
    standard: "One standard",
    rollup: "One roll-up",
  },
}: {
  captions?: Captions;
}) {
  return (
    <figure
      style={{ maxWidth: 680, margin: "2.5rem auto 0" }}
      role="img"
      aria-label="Nine locations measured to one standard, rolling up into a single estate view."
    >
      <svg viewBox="0 0 680 230" width="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <marker id="rg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <g fill="#f4f4f3" stroke="#d4d4d1" strokeWidth="1">
          <rect x="55" y="55" width="52" height="34" rx="4" /><rect x="117" y="55" width="52" height="34" rx="4" /><rect x="179" y="55" width="52" height="34" rx="4" />
          <rect x="55" y="99" width="52" height="34" rx="4" /><rect x="117" y="99" width="52" height="34" rx="4" /><rect x="179" y="99" width="52" height="34" rx="4" />
          <rect x="55" y="143" width="52" height="34" rx="4" /><rect x="117" y="143" width="52" height="34" rx="4" /><rect x="179" y="143" width="52" height="34" rx="4" />
        </g>
        <g fill="#111">
          <rect x="63" y="75" width="28" height="4" rx="2" /><rect x="125" y="75" width="36" height="4" rx="2" /><rect x="187" y="75" width="20" height="4" rx="2" />
          <rect x="63" y="119" width="34" height="4" rx="2" /><rect x="125" y="119" width="24" height="4" rx="2" /><rect x="187" y="119" width="38" height="4" rx="2" />
          <rect x="63" y="163" width="22" height="4" rx="2" /><rect x="125" y="163" width="32" height="4" rx="2" /><rect x="187" y="163" width="27" height="4" rx="2" />
        </g>
        <text x="143" y="200" textAnchor="middle" fontSize="12" fill="#666">{captions.locations}</text>
        <line x1="240" y1="116" x2="272" y2="116" stroke="#111" strokeWidth="1.5" markerEnd="url(#rg-arrow)" />
        <polygon points="318,82 352,116 318,150 284,116" fill="#111" />
        <text x="318" y="200" textAnchor="middle" fontSize="12" fill="#666">{captions.standard}</text>
        <line x1="360" y1="116" x2="420" y2="116" stroke="#111" strokeWidth="1.5" markerEnd="url(#rg-arrow)" />
        <rect x="430" y="50" width="200" height="132" rx="8" fill="#fff" stroke="#d4d4d1" />
        <text x="446" y="74" fontSize="14" fontWeight="500" fill="#111">Estate view</text>
        <g fill="#b4b2a9">
          <rect x="446" y="90" width="90" height="4" rx="2" /><rect x="446" y="106" width="120" height="4" rx="2" /><rect x="446" y="122" width="70" height="4" rx="2" />
        </g>
        <line x1="446" y1="140" x2="614" y2="140" stroke="#eee" />
        <rect x="446" y="154" width="150" height="6" rx="3" fill="#111" />
        <text x="530" y="200" textAnchor="middle" fontSize="12" fill="#666">{captions.rollup}</text>
      </svg>
    </figure>
  );
}

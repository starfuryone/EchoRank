// Site Audit: a page tree -> a crawler sweep -> an issue list with severity dots.
import { Search } from "lucide-react";
import { ACCENT, BAD, Bar, GOOD, HelpArt, MUTED, Panel, STROKE, WARN } from "./shared";

export function SiteAuditArt() {
  return (
    <HelpArt>
      {/* 1. Page tree: a home page and the pages below it */}
      <rect x={14} y={26} width={56} height={22} rx={5} fill="#ffffff" stroke={ACCENT} strokeWidth={2} />
      <Bar x={24} y={34} w={36} h={6} fill={ACCENT} />
      {[62, 92, 122].map((y) => (
        <g key={y}>
          <path d={`M42 48 V ${y} h 14`} fill="none" stroke={STROKE} strokeWidth={2} />
          <rect x={56} y={y - 10} width={52} height={20} rx={5} fill="#ffffff" stroke={STROKE} strokeWidth={2} />
          <Bar x={64} y={y - 3} w={32} h={5} />
        </g>
      ))}

      {/* 2. The crawl sweeping across */}
      <g transform="translate(150, 62)">
        <Search width={28} height={28} stroke={ACCENT} strokeWidth={2} fill="none" />
      </g>
      <path d="M188 76h22" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeDasharray="5 5" className="er-help-flow" />
      <path d="M210 70l7 6-7 6" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* 3. Issues, worst first */}
      <Panel x={228} w={244} />
      {[
        { y: 46, c: BAD, w: 150 },
        { y: 68, c: WARN, w: 174 },
        { y: 90, c: WARN, w: 132 },
        { y: 112, c: GOOD, w: 108 },
      ].map((row) => (
        <g key={row.y}>
          <circle cx={246} cy={row.y} r={5} fill={row.c} />
          <Bar x={260} y={row.y - 4} w={row.w} h={8} fill={row.c === GOOD ? MUTED : row.c === BAD ? "#fecaca" : "#fde68a"} />
        </g>
      ))}
    </HelpArt>
  );
}

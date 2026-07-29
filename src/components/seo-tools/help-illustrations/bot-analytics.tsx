// Bot Analytics: three crawlers approach -> the robots.txt door, half open ->
// the status line each one actually got back, with the refused row picked out.
//
// The half-open door is the point of the whole graphic. robots.txt is a sign on
// a door, not the lock: two bots walk through it and one is turned away at the
// origin anyway. That third panel is the status codes, which is the thing this
// tool knows that a robots.txt reader does not.
//
// Locale-neutral by rule: HTTP status codes are bare numerals and read the same
// in every locale we ship, so no string here needs a catalog entry.
import {
  ACCENT,
  ACCENT_SOFT,
  BAD,
  Bar,
  Connector,
  GOOD,
  HelpArt,
  LABEL,
  MUTED,
  Panel,
  STROKE,
  Tick,
} from "./shared";

/** Three crawlers. y positions only — not anyone's bot list. */
const BOTS = [{ y: 44 }, { y: 76 }, { y: 108 }];

/** What each got back. The middle one is allowed by robots and refused anyway. */
const RESULTS = [
  { y: 44, code: "200", tone: GOOD },
  { y: 76, code: "403", tone: BAD },
  { y: 108, code: "200", tone: GOOD },
];

export function BotAnalyticsArt() {
  return (
    <HelpArt>
      {/* 1. Three crawlers, each a node with a request line */}
      {BOTS.map((b) => (
        <g key={b.y}>
          <rect
            x={12}
            y={b.y - 11}
            width={22}
            height={22}
            rx={6}
            fill={ACCENT_SOFT}
            stroke={ACCENT}
            strokeWidth={2}
          />
          {/* antenna — reads as "bot" at 22px without any text */}
          <line
            x1={23}
            y1={b.y - 11}
            x2={23}
            y2={b.y - 17}
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <circle cx={23} cy={b.y - 19} r={2.5} fill={ACCENT} />
          <Bar x={42} y={b.y - 3} w={44} />
        </g>
      ))}

      <Connector x={96} y={76} len={22} />

      {/* 2. robots.txt as a half-open door: frame, swung leaf, gap */}
      <Panel x={132} w={96} />
      <rect
        x={152}
        y={44}
        width={40}
        height={64}
        rx={3}
        fill="#ffffff"
        stroke={STROKE}
        strokeWidth={2}
      />
      {/* the leaf, opened toward the viewer */}
      <path
        d="M192 44l24 -9v82l-24 -9z"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={196} cy={78} r={2.5} fill={ACCENT} />
      {/* the sign on the door — lines, deliberately unreadable */}
      <Bar x={158} y={54} w={26} h={4} fill={MUTED} />
      <Bar x={158} y={63} w={18} h={4} fill={MUTED} />
      <Bar x={158} y={72} w={22} h={4} fill={MUTED} />

      <Connector x={236} y={76} len={22} />

      {/* 3. The status line each crawler actually got */}
      <Panel x={274} w={198} />
      {RESULTS.map((r) => {
        const refused = r.tone === BAD;
        return (
          <g key={r.y}>
            {/* the refused row is the one the eye should land on */}
            {refused && (
              <rect
                x={284}
                y={r.y - 12}
                width={178}
                height={24}
                rx={6}
                fill="#fef2f2"
                stroke={BAD}
                strokeWidth={1.5}
              />
            )}
            <circle cx={298} cy={r.y} r={4.5} fill={r.tone} />
            <Bar
              x={310}
              y={r.y - 3}
              w={refused ? 84 : 104}
              fill={refused ? "#fca5a5" : MUTED}
            />
            <Tick
              x={454}
              y={r.y + 4}
              anchor="end"
              fill={r.tone}
              weight={refused ? 700 : 600}
            >
              {r.code}
            </Tick>
          </g>
        );
      })}
      {/* baseline tick marks the panel as a log of responses, not a score */}
      <Bar x={284} y={122} w={40} h={3} fill={LABEL} />
    </HelpArt>
  );
}

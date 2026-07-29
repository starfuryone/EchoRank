// Custom Prompts: one question -> the AI assistants it is put to -> the stored
// answer, with the line that names you highlighted and the trend rising.
//
// The three nodes are the category "AI assistants", not a count: PromptRun
// carries an `engine` column and Brand Radar renders a row per engine, but only
// one engine is configured today. Nothing here asserts a number, and no text
// means nothing to translate.
import { MessageSquareText } from "lucide-react";
import {
  ACCENT,
  ACCENT_SOFT,
  Bar,
  FILL,
  GOOD,
  HelpArt,
  MUTED,
  Panel,
  STROKE,
} from "./shared";

/** Vertical centres of the assistant nodes. */
const NODES = [40, 76, 112];

export function CustomPromptsArt() {
  return (
    <HelpArt>
      {/* 1. The question, phrased the way a customer asks it */}
      <rect x={8} y={60} width={132} height={32} rx={16} fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth={2} />
      <g transform="translate(20, 68)">
        <MessageSquareText width={16} height={16} stroke={ACCENT} strokeWidth={2} fill="none" />
      </g>
      <Bar x={44} y={72} w={84} h={8} fill={ACCENT} />

      {/* 2. Put to the assistants */}
      {NODES.map((cy) => (
        <g key={cy}>
          <path
            d={`M140 76 C 166 76, 168 ${cy}, 186 ${cy}`}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="5 5"
            className="er-help-flow"
          />
          <circle cx={202} cy={cy} r={15} fill={FILL} stroke={STROKE} strokeWidth={2} />
          <circle cx={202} cy={cy} r={5} fill={ACCENT} />
          <path
            d={`M218 ${cy} C 236 ${cy}, 238 76, 254 76`}
            fill="none"
            stroke={STROKE}
            strokeWidth={2}
          />
        </g>
      ))}

      {/* 3. The stored answer. One line names you — that is the whole product. */}
      <Panel x={262} w={210} />
      <Bar x={278} y={40} w={162} h={7} />
      <Bar x={278} y={54} w={140} h={7} />
      <rect x={272} y={68} width={190} height={20} rx={5} fill="#ecfdf5" stroke={GOOD} strokeWidth={1.5} />
      <circle cx={284} cy={78} r={4} fill={GOOD} />
      <Bar x={296} y={74} w={150} h={7} fill={GOOD} />
      <Bar x={278} y={96} w={120} h={7} fill={MUTED} />

      {/* Mentioned more often than last week */}
      <path
        d="M392 118 l14 -12 l10 8 l16 -16"
        fill="none"
        stroke={GOOD}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M422 98 L432 98 L432 108"
        fill="none"
        stroke={GOOD}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </HelpArt>
  );
}

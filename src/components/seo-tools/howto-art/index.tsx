// The How-to pictograms, one per step id (howto-copy.ts HOWTO_ART). Each is a
// 120×80 line drawing in currentColor with an emerald accent; none carries
// text, so every locale shares them.

import type { HowtoArtId } from "@/lib/site-crawler/howto-copy";
import { Accent, Card, Frame, Line } from "./frame";

const ART: Record<HowtoArtId, () => React.JSX.Element> = {
  // ── Overview ──────────────────────────────────────────────────────────
  "paste-url": () => (
    <Frame label="paste-url">
      <Card x={10} y={26} w={100} h={22} />
      <Line x={18} y={37} w={52} />
      <Accent>
        <path d="M78 30v14" />
        <path d="M86 56l8 14 3-6 6-1z" />
      </Accent>
    </Frame>
  ),
  "mode-render": () => (
    <Frame label="mode-render">
      <Card x={12} y={16} w={44} h={20} />
      <Card x={64} y={16} w={44} h={20} />
      <Accent>
        <rect x={12} y={16} width={44} height={20} rx={4} />
        <path d="M24 26h20" />
        <rect x={40} y={50} width={30} height={16} rx={8} />
        <circle cx={62} cy={58} r={5} />
      </Accent>
      <Line x={76} y={26} w={20} />
    </Frame>
  ),
  advanced: () => (
    <Frame label="advanced">
      <Card x={14} y={10} w={92} h={18} />
      <Card x={14} y={32} w={92} h={18} />
      <Card x={14} y={54} w={92} h={18} />
      <Line x={22} y={41} w={40} />
      <Line x={22} y={63} w={40} />
      <Accent>
        <path d="M22 19h34" />
        <path d="M92 16l5 4-5 4" />
      </Accent>
    </Frame>
  ),
  "review-plan": () => (
    <Frame label="review-plan">
      <Card x={18} y={8} w={84} h={64} />
      <Line x={44} y={24} w={46} />
      <Line x={44} y={40} w={46} />
      <Line x={44} y={56} w={30} />
      <Accent>
        <path d="M28 24l4 4 7-8" />
        <path d="M28 40l4 4 7-8" />
        <path d="M28 56l4 4 7-8" />
      </Accent>
    </Frame>
  ),
  start: () => (
    <Frame label="start">
      <Card x={20} y={22} w={80} h={36} />
      <Accent>
        <circle cx={60} cy={40} r={12} />
        <path d="M56 34l9 6-9 6z" />
      </Accent>
    </Frame>
  ),
  // ── Issues ────────────────────────────────────────────────────────────
  "fix-first": () => (
    <Frame label="fix-first">
      <Card x={8} y={18} w={104} h={44} />
      <Accent>
        <rect x={16} y={28} width={22} height={22} rx={6} />
        <path d="M27 32v6M27 44v2M23 38h8" />
        <path d="M46 34h36" />
      </Accent>
      <Line x={46} y={46} w={52} />
    </Frame>
  ),
  // Issue vs warning vs opportunity: three shapes, three rows, three weights.
  kinds: () => (
    <Frame label="kinds">
      <circle cx={20} cy={18} r={6} />
      <path d="M20 54l7 12H13z" />
      <Line x={34} y={18} w={70} />
      <Line x={34} y={40} w={46} />
      <Line x={34} y={62} w={24} />
      <Accent>
        <path d="M20 33l7 7-7 7-7-7z" />
        <path d="M34 40h46" />
      </Accent>
    </Frame>
  ),
  "expand-rule": () => (
    <Frame label="expand-rule">
      <Card x={10} y={8} w={100} h={18} />
      <Line x={18} y={17} w={44} />
      <Accent>
        <path d="M94 14l5 5 5-5" />
        <rect x={10} y={30} width={100} height={42} rx={4} />
      </Accent>
      <Line x={20} y={42} w={60} />
      <Line x={20} y={52} w={72} />
      <Line x={20} y={62} w={40} />
    </Frame>
  ),
  "affected-pages": () => (
    <Frame label="affected-pages">
      <Card x={14} y={14} w={34} h={44} />
      <Card x={22} y={22} w={34} h={44} />
      <Accent>
        <path d="M66 44h34" />
        <path d="M92 36l8 8-8 8" />
      </Accent>
    </Frame>
  ),
  export: () => (
    <Frame label="export">
      <path d="M30 50v14h60V50" />
      <Accent>
        <path d="M60 12v38" />
        <path d="M48 38l12 12 12-12" />
      </Accent>
    </Frame>
  ),
  // ── Pages ─────────────────────────────────────────────────────────────
  "search-scope": () => (
    <Frame label="search-scope">
      <Card x={8} y={24} w={66} h={22} />
      <Accent>
        <circle cx={22} cy={35} r={6} />
        <path d="M27 40l4 4" />
        <path d="M84 24h28l-11 13v11l-6 4V37z" />
      </Accent>
      <Line x={36} y={35} w={30} />
    </Frame>
  ),
  // Page score: 100, minus a big block per high, a medium one, a sliver per low.
  "page-score": () => (
    <Frame label="page-score">
      <rect x={10} y={30} width={100} height={20} rx={3} />
      <Accent>
        <rect x={10} y={30} width={58} height={20} rx={3} />
      </Accent>
      <path d="M68 30v20M98 30v20M108 30v20" />
      {/* What each kind of finding takes off, sized by its weight: high, medium, low. */}
      <path d="M71 20h24M101 20h4M108 20h1" />
    </Frame>
  ),
  "sort-detail": () => (
    <Frame label="sort-detail">
      <Line x={10} y={20} w={46} />
      <Line x={10} y={36} w={46} />
      <Line x={10} y={52} w={46} />
      <path d="M64 16v40M58 50l6 6 6-6" />
      <Accent>
        <rect x={80} y={8} width={32} height={64} rx={4} />
        <path d="M88 22h16M88 32h12M88 42h16" />
      </Accent>
    </Frame>
  ),
  "metric-columns": () => (
    <Frame label="metric-columns">
      <Card x={8} y={12} w={104} h={56} />
      <path d="M36 12v56M64 12v56" />
      <Accent>
        <rect x={68} y={16} width={40} height={48} rx={2} />
        <path d="M76 52v-10M86 52v-18M96 52v-6" />
      </Accent>
    </Frame>
  ),
  // ── History ───────────────────────────────────────────────────────────
  "find-crawl": () => (
    <Frame label="find-crawl">
      <Card x={10} y={10} w={70} h={14} />
      <Card x={10} y={30} w={70} h={14} />
      <Card x={10} y={50} w={70} h={14} />
      <Accent>
        <circle cx={92} cy={38} r={10} />
        <path d="M99 45l9 9" />
      </Accent>
    </Frame>
  ),
  "read-metrics": () => (
    <Frame label="read-metrics">
      <path d="M14 62V40M24 62V30" />
      <path d="M48 62V22M58 62V44" />
      <Accent>
        <path d="M80 54a16 16 0 1 1 26 0" />
        <path d="M93 52l6-10" />
      </Accent>
    </Frame>
  ),
  pin: () => (
    <Frame label="pin">
      <Card x={16} y={20} w={60} h={46} />
      <Line x={26} y={34} w={40} />
      <Line x={26} y={46} w={28} />
      <Accent>
        <path d="M88 12l18 18-6 2-8 8 1 7-4 4-10-10-9 9M84 26l-4 4 10 10" />
      </Accent>
    </Frame>
  ),
  "open-report": () => (
    <Frame label="open-report">
      <Card x={14} y={14} w={44} h={52} />
      <Line x={22} y={28} w={28} />
      <Line x={22} y={38} w={20} />
      <Accent>
        <path d="M68 40h36M96 32l8 8-8 8" />
      </Accent>
    </Frame>
  ),
  compare: () => (
    <Frame label="compare">
      <Card x={10} y={14} w={40} h={52} />
      <Card x={70} y={14} w={40} h={52} />
      <Line x={18} y={30} w={24} />
      <Line x={78} y={30} w={24} />
      <Accent>
        <path d="M54 34h12M62 30l4 4-4 4" />
        <path d="M66 50H54M58 46l-4 4 4 4" />
      </Accent>
    </Frame>
  ),
  // ── Schedules ─────────────────────────────────────────────────────────
  "create-schedule": () => (
    <Frame label="create-schedule">
      <rect x={18} y={16} width={56} height={50} rx={5} />
      <path d="M18 30h56M32 10v10M60 10v10" />
      <Accent>
        <circle cx={90} cy={50} r={14} />
        <path d="M90 43v14M83 50h14" />
      </Accent>
    </Frame>
  ),
  "cadence-time": () => (
    <Frame label="cadence-time">
      <rect x={10} y={18} width={44} height={44} rx={5} />
      <path d="M10 30h44M22 40h4M34 40h4M22 50h4" />
      <Accent>
        <circle cx={86} cy={40} r={20} />
        <path d="M86 28v12l8 6" />
      </Accent>
    </Frame>
  ),
  "export-targets": () => (
    <Frame label="export-targets">
      <rect x={10} y={20} width={44} height={32} rx={4} />
      <path d="M10 24l22 16 22-16" />
      <Accent>
        <rect x={66} y={16} width={44} height={44} rx={4} />
        <path d="M66 31h44M66 46h44M81 16v44M96 16v44" />
      </Accent>
    </Frame>
  ),
  "toggle-run": () => (
    <Frame label="toggle-run">
      <rect x={10} y={28} width={44} height={24} rx={12} />
      <Accent>
        <circle cx={42} cy={40} r={8} />
        <circle cx={88} cy={40} r={18} />
        <path d="M83 31l13 9-13 9z" />
      </Accent>
    </Frame>
  ),
};

export function HowtoArt({ id }: { id: HowtoArtId }) {
  const Art = ART[id];
  return <Art />;
}

export const HOWTO_ART_IDS = Object.keys(ART) as HowtoArtId[];

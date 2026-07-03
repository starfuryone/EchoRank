export type SignalSource =
  | 'review'
  | 'feedback'
  | 'visibility'
  | 'support'
  | 'social'
  | 'news'
  | 'competitor'
  | 'manual';

export const SIGNAL_SOURCES: SignalSource[] = [
  'review', 'feedback', 'visibility', 'support', 'social', 'news', 'competitor', 'manual',
];

export interface RawSignalInput {
  tenantId: string;
  source: SignalSource;
  /** Stable id in the source system. Strongly recommended — drives dedupe. */
  externalId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  occurredAt: Date;
  /** -1 (hostile) .. 1 (glowing) */
  sentiment: number;
  /** 0 (noise) .. 1 (existential) */
  severity: number;
  /** 0..1 reach/weight (review length, audience size…). Default 0.5 */
  magnitude?: number;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RiskComponents {
  /** Time-decayed weighted negativity, 0..1 */
  negativePressure: number;
  /** Negative-signal velocity vs trailing 4-week baseline, 0..1 */
  velocity: number;
  /** Recent critical signals (severity ≥ 0.8), 0..1 */
  criticalRecent: number;
  /** Inverse of latest AI visibility score, 0..1, null if no audit data */
  visibility: number | null;
  /** Penalty for signal drought (no data = blind spot), 0..1 */
  stagnation: number;
}

export interface RiskDriver {
  signalId: string;
  source: SignalSource;
  title: string;
  occurredAt: string; // ISO
  sentiment: number;
  severity: number;
  /** Normalized share of total negative contribution, 0..1 */
  contribution: number;
}

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface RiskResult {
  score: number; // 0..100, higher = more risk
  grade: RiskGrade;
  components: RiskComponents;
  drivers: RiskDriver[];
  signalCount: number;
  window: { from: string; to: string };
}

export function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
}

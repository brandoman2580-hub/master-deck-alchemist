/**
 * Deno mirror of lib/engine/types.ts — FactsEnvelope contracts.
 */

export const FACTS_SCHEMA_VERSION = "0.3.0" as const;

export type EngineFormat = "TCG" | "MASTER_DUEL";

export type FormatRulePackId =
  | "tcgTournament"
  | "masterDuelMaxxC"
  | "none";

export type YugiohPlayStrategy =
  | "Combo"
  | "Control"
  | "Aggro / Beatdown"
  | "OTK / FTK"
  | "Stun / Floodgate"
  | "Burn"
  | "Swarm"
  | "Midrange / Hybrid";

export type CardRoleTag =
  | "Starter"
  | "Extender"
  | "Chokepoint"
  | "Bait"
  | "Lock"
  | "Endboard"
  | "Board Breaker"
  | "Hand Trap";

export type CollisionSeverity = "info" | "warning" | "error";

export interface Collision {
  code: string;
  severity: CollisionSeverity;
  message: string;
  cardIds?: number[];
}

export interface RoleCoverage {
  starters: number;
  extenders: number;
  handTraps: number;
  boardBreakers: number;
  endboardPieces: number;
  locks: number;
}

export interface StrategyFit {
  primaryArchetype: string | null;
  primaryStrategy: YugiohPlayStrategy | null;
  secondaryStrategy: YugiohPlayStrategy | null;
  fitScore: number;
  notes: string[];
}

export interface BossCard {
  cardId: number;
  name: string;
  zone: "main" | "extra" | "side";
}

export interface ConsistencyStats {
  n: number;
  starterAccess: number;
  brickRate: number;
  oneInterruptionSurvival: number;
}

export interface MatchupReadiness {
  opponentArchetype: string;
  opponentDeckId?: string;
  tier?: string;
  metaShare?: number;
  starterAccessDelta: number;
  brickRateDelta: number;
  tagAdvantage: number;
  opponentStrategy: YugiohPlayStrategy | null;
  disruptionScore: number;
  consistencyScore: number;
  notes: string[];
}

export interface ComboNode {
  id: string;
  label: string;
  cardIds: number[];
  kind: "hand" | "step" | "endboard" | "choke" | "killer";
}

export interface ComboEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ComboLine {
  id: string;
  name: string;
  nodes: ComboNode[];
  edges: ComboEdge[];
  killers: string[];
  endboardSummary: string;
  fallbackSummary?: string;
}

export interface ComboGraphSummary {
  lines: ComboLine[];
  source: "template" | "compiled" | "empty";
}

export interface GradeAxisContribution {
  key: string;
  label: string;
  value: number;
  note?: string;
}

export interface GradeBreakdown {
  consistency: GradeAxisContribution[];
  power: GradeAxisContribution[];
  resilience: GradeAxisContribution[];
  disruption: GradeAxisContribution[];
  synergyNotes: string[];
  formatPackNotes: string[];
}

export interface WorkshopGradeAxes {
  consistency: number;
  power: number;
  resilience: number;
  disruption: number;
  letter: "S" | "A" | "B" | "C" | "D" | "F";
  synergyFactor: number;
  formatRulePack: FormatRulePackId;
  breakdown: GradeBreakdown;
}

export interface LegalityBlock {
  ok: boolean;
  errors: string[];
}

export interface RestrictionFact {
  cardId: number;
  name: string;
  lockSummary: string;
  appliesTo: "extra_deck" | "special_summon" | "summon" | "other";
  evidenceId: string;
}

export interface DiagnosticsBlock {
  collisions: Collision[];
  roleCoverage: RoleCoverage;
  strategyFit: StrategyFit;
  bosses: BossCard[];
  restrictions: RestrictionFact[];
}

export interface FactsEnvelope {
  schemaVersion: typeof FACTS_SCHEMA_VERSION | string;
  deckId: string;
  deckHash: string;
  format: EngineFormat;
  legality: LegalityBlock;
  diagnostics: DiagnosticsBlock;
  consistency: ConsistencyStats;
  matchups: MatchupReadiness[];
  combos: ComboGraphSummary;
  grade: WorkshopGradeAxes;
}

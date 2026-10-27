/**
 * Canonical Facts Brain contracts.
 * All Assistant / Matchups / Combos consumers share this envelope.
 * Groq may only coach from validated fields present here.
 */

/** Bumped when matchup rows carry opponent strategy and component scores. */
export const FACTS_SCHEMA_VERSION = "0.3.0" as const;

/** Active format scoring pack id (never merges TCG ↔ MD banlists). */
export type FormatRulePackId =
  | "tcgTournament"
  | "masterDuelMaxxC"
  | "none";

export interface GradeAxisContribution {
  key: string;
  label: string;
  /** Numeric contribution or raw metric used in the axis explanation. */
  value: number;
  note?: string;
}

/**
 * Deterministic, prompt-safe explanation of how each KPI was derived.
 * Synergy stays internal (factor + notes) — not a fifth chrome axis.
 */
export interface GradeBreakdown {
  consistency: GradeAxisContribution[];
  power: GradeAxisContribution[];
  resilience: GradeAxisContribution[];
  disruption: GradeAxisContribution[];
  synergyNotes: string[];
  formatPackNotes: string[];
}

export type EngineFormat = "TCG" | "MASTER_DUEL";

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
  fitScore: number; // 0-100
  notes: string[];
}

export interface BossCard {
  cardId: number;
  name: string;
  zone: "main" | "extra" | "side";
}

export interface ConsistencyStats {
  n: number;
  starterAccess: number; // 0-1
  brickRate: number; // 0-1
  oneInterruptionSurvival: number; // 0-1
}

export interface MatchupReadiness {
  opponentArchetype: string;
  opponentDeckId?: string;
  tier?: string;
  /** Soft meta representation for chart X (0–100). */
  metaShare?: number;
  starterAccessDelta: number;
  brickRateDelta: number;
  tagAdvantage: number; // -1..1 rough readiness
  /** Template strategy used by the scorer. Null when the tier row has none. */
  opponentStrategy: YugiohPlayStrategy | null;
  /** Hand-trap and breaker coverage versus this opponent, clamped −1..1. */
  disruptionScore: number;
  /** Starter access, brick, and interruption survival versus this opponent, clamped −1..1. */
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
  /** Optional choke fallback note from curated templates. */
  fallbackSummary?: string;
}

export interface ComboGraphSummary {
  lines: ComboLine[];
  source: "template" | "compiled" | "empty";
}

export interface WorkshopGradeAxes {
  consistency: number; // 0-100
  power: number;
  resilience: number;
  disruption: number;
  letter: "S" | "A" | "B" | "C" | "D" | "F";
  /** Internal modifier applied to Consistency/Power only (typically 0.85–1.15). */
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
  /** Extracted Extra Deck / summon locks from effect text. */
  restrictions: RestrictionFact[];
}

/**
 * Versioned facts payload shared by Workshop Matchups, Combos, grade, and Assistant.
 */
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

/** Minimal deck shape accepted by hashing (avoids coupling to full DeckType). */
export interface HashableDeckCard {
  id: number;
}

export interface HashableDeck {
  deckFormat: "TCG" | "Master Duel" | string;
  mainDeck: HashableDeckCard[];
  extraDeck: HashableDeckCard[];
  sideDeck: HashableDeckCard[];
}

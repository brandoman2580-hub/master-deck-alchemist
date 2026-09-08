/**
 * Canonical Facts Brain contracts.
 * All Assistant / Matchups / Combos consumers share this envelope.
 * Groq may only coach from validated fields present here.
 */

export const FACTS_SCHEMA_VERSION = "0.1.0" as const;

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
}

export interface LegalityBlock {
  ok: boolean;
  errors: string[];
}

export interface DiagnosticsBlock {
  collisions: Collision[];
  roleCoverage: RoleCoverage;
  strategyFit: StrategyFit;
  bosses: BossCard[];
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
  mode: "TCG" | "Master Duel" | string;
  mainDeck: HashableDeckCard[];
  extraDeck: HashableDeckCard[];
  sideDeck: HashableDeckCard[];
}

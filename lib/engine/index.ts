/**
 * MDA Facts Brain — public surface.
 */

export { FACTS_SCHEMA_VERSION } from "./types";
export type {
  BossCard,
  CardRoleTag,
  Collision,
  ComboEdge,
  ComboGraphSummary,
  ComboLine,
  ComboNode,
  ConsistencyStats,
  DiagnosticsBlock,
  EngineFormat,
  FactsEnvelope,
  HashableDeck,
  HashableDeckCard,
  LegalityBlock,
  MatchupReadiness,
  RoleCoverage,
  StrategyFit,
  WorkshopGradeAxes,
  YugiohPlayStrategy,
} from "./types";

export { computeDeckHash, toEngineFormat } from "./deck-hash";
export {
  evaluateAssistantEligibility,
  evaluateDeckLegality,
  isDeckPersisted,
} from "./legality";
export {
  buildDiagnostics,
  type ArchetypeStrategyRow,
  type StrategyWeightRow,
} from "./diagnostics";
export {
  buildFactsEnvelope,
  formatFactsForPrompt,
} from "./build-facts";
export {
  loadStrategyKnowledge,
  readDeckAnalysisCache,
  upsertDeckAnalysisCache,
} from "./facts-cache";
export {
  classifyOpeningHand,
  fisherYatesShuffle,
  simulateConsistency,
  type TaggedMainCard,
} from "./consistency";
export {
  readinessToDisplayWinRate,
  scoreMatchupReadiness,
  type MetaMatchupTemplate,
} from "./matchups";
export { gradeFromFacts } from "./grade";
export { tagMainDeckForConsistency } from "./tag-main-deck";
export { loadMetaMatchupTemplates } from "./meta-templates";
export { runConsistencySimulation } from "./worker/client";
export {
  cardsForNode,
  compileCombos,
  compileFallbackLine,
  selectTemplatesForArchetype,
  validateComboTemplate,
  type ComboTemplateRow,
  type DeckCardRef,
} from "./combos";
export { loadComboTemplates } from "./combo-templates";
export {
  VALIDATED_FACTS_HARD_RULE,
  buildCoachSystemPrompt,
  mentionsInventedQuantitativeClaims,
  withValidatedFactsHardRule,
} from "./coaching";
export { getFacts, type GetFactsOptions } from "./get-facts";
export {
  scoreStrategyUtility,
  weightsForStrategy,
  type StrategyUtilityFeatures,
  type StrategyUtilityWeights,
} from "./strategy-utility";

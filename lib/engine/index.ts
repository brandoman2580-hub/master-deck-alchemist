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
  FormatRulePackId,
  GradeAxisContribution,
  GradeBreakdown,
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
  packDeckCardsForPrompt,
  resolveFactsPromptCaps,
  prioritySlice,
} from "./build-facts";
export type { FormatFactsOptions } from "./build-facts";
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
export { emptyWorkshopGradeAxes, gradeFromFacts } from "./grade";
export {
  applyFormatRulePack,
  MAXX_C_CARD_NAME,
  MAXX_C_HARD_OUT_NAMES,
  maxxOutResilienceDelta,
  type FormatRulePackInput,
  type FormatRulePackResult,
} from "./format-rule-packs";
export {
  computePrimaryArchetypeShare,
  computeSynergyModifier,
} from "./synergy-modifier";
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
  containsCasualCoachTone,
  mentionsInventedQuantitativeClaims,
  withValidatedFactsHardRule,
} from "./coaching";
export { getFacts, isUsableCachedFacts, type GetFactsOptions } from "./get-facts";
export {
  scoreStrategyUtility,
  weightsForStrategy,
  type StrategyUtilityFeatures,
  type StrategyUtilityWeights,
} from "./strategy-utility";
export {
  ASSISTANT_MODES,
  DeckAssistantRequestSchema,
  DeckCoachResponseSchema,
  EvidenceIds,
  IntentClassificationSchema,
  OFF_DOMAIN_REFUSAL_MESSAGE,
  REDIRECT_HINT_VALUES,
  buildOutOfBoundsCoachResponse,
  evidenceHintsForQaFocus,
  mergeCoachRedirectHint,
  parseDeckCoachResponse,
  parseIntentClassification,
  resolveWorkshopTabRedirect,
  type AssistantMode,
  type CoachRecommendationCard,
  type DeckAssistantRequest,
  type DeckCoachResponse,
  type IntentClassification,
  type QaFocus,
  type RedirectHint,
  type ResolvedAssistantMode,
  type SynergyCandidate,
  type TuningRecommendation,
} from "./assistant-contract";
export {
  classifyIntentHeuristic,
  classifyOutOfBoundsHeuristic,
  isDeckOrCardDomainRelevant,
  resolveAssistantMode,
  resolveCardEntitiesFromNames,
} from "./mode-router";
export {
  detectHeuristicRoleSlugs,
  heuristicSlugsToCardRoleTags,
  measureWeightCoverage,
  type HeuristicCardInput,
  type HeuristicRoleSlug,
  type RoleCoverageSourceStats,
} from "./card-role-heuristics";
export {
  banStatusAgainstMap,
  normalizeBanStatus,
  verifyCardNamesAgainstLibrary,
} from "./verify-cards";
export {
  buildLiveDeckSnapshot,
  countSectionEntries,
  type DeckSnapshot,
  type DeckSnapshotEntry,
} from "./deck-snapshot";
export {
  extractEngineConditions,
  scoreConditionFit,
  rankConditionsForQuestion,
  buildSynergyFitSummary,
  archetypeOverlapPenalty,
  synergyFamilyKey,
  diversifyByFamily,
  parseDiscoveryFilters,
  discoveryFilterBoost,
  askIntentBoost,
  buildDiscoveryCondition,
  type EngineCondition,
  type EngineConditionCard,
  type DiscoveryFilters,
} from "./engine-conditions";
export {
  consistencyDelta,
  scoreCopyVariant,
  selectTuneCandidateIds,
} from "./tune-variants";
export {
  collectDeckArchetypes,
  extractTowardPhrases,
  resolveBridgeArchetypes,
  BRIDGE_ARCHETYPE_ALIASES,
} from "./bridge-archetypes";
export {
  canAddCardUnderBanlist,
  countCardCopiesInSections,
  maxCopiesForBanStatus,
} from "./synergy-eligibility";
export {
  buildTuningFromVariants,
  collectAllowedEvidenceIds,
  isTuningRowInVariants,
  mergeGroqTuningReasons,
  sanitizeCoachEvidence,
} from "./coach-guardrails";
export {
  extractRestrictions,
  detectPackageLockConflicts,
  isLikelyExtraDeckCard,
  type RestrictionFact,
} from "./restrictions";
export {
  formatPlayerChangeReason,
  defaultPlayerTradeoffs,
} from "./player-voice";

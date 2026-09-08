import type { YugiohPlayStrategy } from "./types";

/**
 * Macro play-strategy utility weights for scoring candidate actions/lines.
 * U(a) = w_b B + w_i I + w_c C + w_r R - w_v V - w_l L
 */
export interface StrategyUtilityWeights {
  boardQuality: number; // w_b
  interaction: number; // w_i
  consistency: number; // w_c
  recovery: number; // w_r
  overextension: number; // w_v (penalty)
  lockoutRisk: number; // w_l (penalty)
}

export interface StrategyUtilityFeatures {
  /** Board quality / endboard pressure 0–1 */
  boardQuality: number;
  /** Retained interaction 0–1 */
  interaction: number;
  /** Consistency contribution 0–1 */
  consistency: number;
  /** Long-term recovery 0–1 */
  recovery: number;
  /** Overextension / brick vulnerability 0–1 */
  overextension: number;
  /** Lock / floodgate dependency risk 0–1 */
  lockoutRisk: number;
}

const PROFILE_WEIGHTS: Record<YugiohPlayStrategy, StrategyUtilityWeights> = {
  Combo: {
    boardQuality: 0.35,
    interaction: 0.1,
    consistency: 0.35,
    recovery: 0.1,
    overextension: 0.15,
    lockoutRisk: 0.1,
  },
  Swarm: {
    boardQuality: 0.35,
    interaction: 0.1,
    consistency: 0.35,
    recovery: 0.1,
    overextension: 0.15,
    lockoutRisk: 0.1,
  },
  Control: {
    boardQuality: 0.15,
    interaction: 0.35,
    consistency: 0.2,
    recovery: 0.25,
    overextension: 0.2,
    lockoutRisk: 0.1,
  },
  "Stun / Floodgate": {
    boardQuality: 0.1,
    interaction: 0.35,
    consistency: 0.2,
    recovery: 0.2,
    overextension: 0.15,
    lockoutRisk: 0.25,
  },
  "OTK / FTK": {
    boardQuality: 0.55,
    interaction: 0.1,
    consistency: 0.3,
    recovery: 0,
    overextension: 0.2,
    lockoutRisk: 0.1,
  },
  "Aggro / Beatdown": {
    boardQuality: 0.4,
    interaction: 0.15,
    consistency: 0.25,
    recovery: 0.1,
    overextension: 0.15,
    lockoutRisk: 0.1,
  },
  Burn: {
    boardQuality: 0.25,
    interaction: 0.2,
    consistency: 0.3,
    recovery: 0.15,
    overextension: 0.15,
    lockoutRisk: 0.1,
  },
  "Midrange / Hybrid": {
    boardQuality: 0.25,
    interaction: 0.25,
    consistency: 0.25,
    recovery: 0.2,
    overextension: 0.15,
    lockoutRisk: 0.1,
  },
};

export function weightsForStrategy(
  strategy: YugiohPlayStrategy | null | undefined,
): StrategyUtilityWeights {
  if (!strategy) return PROFILE_WEIGHTS["Midrange / Hybrid"];
  return PROFILE_WEIGHTS[strategy];
}

/**
 * Score an action/line under a strategy profile.
 * Higher is better; penalties subtract overextension / lockout risk.
 */
export function scoreStrategyUtility(
  strategy: YugiohPlayStrategy | null | undefined,
  features: StrategyUtilityFeatures,
): number {
  const w = weightsForStrategy(strategy);
  const raw =
    w.boardQuality * features.boardQuality +
    w.interaction * features.interaction +
    w.consistency * features.consistency +
    w.recovery * features.recovery -
    w.overextension * features.overextension -
    w.lockoutRisk * features.lockoutRisk;
  return Math.max(0, Math.min(1, raw));
}

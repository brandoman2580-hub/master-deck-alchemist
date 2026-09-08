import {
  VALIDATED_FACTS_HARD_RULE,
  buildCoachSystemPrompt,
  mentionsInventedQuantitativeClaims,
  withValidatedFactsHardRule,
} from "@/lib/engine/coaching";
import {
  scoreStrategyUtility,
  weightsForStrategy,
} from "@/lib/engine/strategy-utility";

describe("coaching hard rule helpers", () => {
  it("prefixes system prompts with the validated facts hard rule", () => {
    const out = withValidatedFactsHardRule("You are a coach.");
    expect(out.startsWith(VALIDATED_FACTS_HARD_RULE)).toBe(true);
    expect(out).toContain("You are a coach.");
  });

  it("buildCoachSystemPrompt includes hard rule and facts block when provided", () => {
    const prompt = buildCoachSystemPrompt(
      "Base coach role.",
      "VALIDATED FACTS:\nbrickRate: 0.12",
    );
    expect(prompt).toContain(VALIDATED_FACTS_HARD_RULE);
    expect(prompt).toContain("VALIDATED FACTS:\nbrickRate: 0.12");
    expect(prompt).toContain("Base coach role.");
  });

  it("buildCoachSystemPrompt warns when no facts block is attached", () => {
    const prompt = buildCoachSystemPrompt("Base coach role.");
    expect(prompt).toContain("do not invent quantitative deck metrics");
  });

  it("flags invented quantitative claim language", () => {
    expect(
      mentionsInventedQuantitativeClaims("Your brick rate is about 25% brick"),
    ).toBe(true);
    expect(
      mentionsInventedQuantitativeClaims("This deck struggles into floodgates."),
    ).toBe(false);
  });
});

describe("strategy utility weights", () => {
  it("returns Midrange weights when strategy is missing", () => {
    const mid = weightsForStrategy("Midrange / Hybrid");
    expect(weightsForStrategy(null)).toEqual(mid);
    expect(weightsForStrategy(undefined)).toEqual(mid);
  });

  it("scores Combo lines with higher board/consistency contribution", () => {
    const features = {
      boardQuality: 0.9,
      interaction: 0.2,
      consistency: 0.8,
      recovery: 0.2,
      overextension: 0.1,
      lockoutRisk: 0.1,
    };
    const combo = scoreStrategyUtility("Combo", features);
    const control = scoreStrategyUtility("Control", features);
    expect(combo).toBeGreaterThan(control);
    expect(combo).toBeGreaterThan(0);
    expect(combo).toBeLessThanOrEqual(1);
  });

  it("penalizes Stun profiles for high lockout risk", () => {
    const safe = scoreStrategyUtility("Stun / Floodgate", {
      boardQuality: 0.4,
      interaction: 0.7,
      consistency: 0.5,
      recovery: 0.4,
      overextension: 0.1,
      lockoutRisk: 0.1,
    });
    const risky = scoreStrategyUtility("Stun / Floodgate", {
      boardQuality: 0.4,
      interaction: 0.7,
      consistency: 0.5,
      recovery: 0.4,
      overextension: 0.1,
      lockoutRisk: 0.9,
    });
    expect(safe).toBeGreaterThan(risky);
  });
});

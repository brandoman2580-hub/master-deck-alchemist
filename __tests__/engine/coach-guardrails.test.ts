/**
 * Coach guardrails: tuning clamp + evidence allowlist.
 */
import { EvidenceIds } from "@/lib/engine/assistant-contract";
import {
  buildTuningFromVariants,
  collectAllowedEvidenceIds,
  isTuningRowInVariants,
  mergeGroqTuningReasons,
  sanitizeCoachEvidence,
} from "@/lib/engine/coach-guardrails";
import { evidenceHintsForQaFocus } from "@/lib/engine/assistant-contract";

describe("coach guardrails — tuning clamp", () => {
  const variants = [
    {
      cardId: "100",
      fromCopies: 3,
      toCopies: 2,
      evidenceId: EvidenceIds.variant(100, 3, 2),
      factsDelta: {
        starterAccess: 0.02,
        brickRate: -0.03,
        oneInterruptionSurvival: 0.01,
      },
    },
    {
      cardId: "200",
      fromCopies: 2,
      toCopies: 1,
      evidenceId: EvidenceIds.variant(200, 2, 1),
      factsDelta: {
        starterAccess: 0.01,
        brickRate: -0.01,
        oneInterruptionSurvival: 0,
      },
    },
  ];

  it("buildTuningFromVariants only emits known variant cardIds/from/to", () => {
    const tuning = buildTuningFromVariants(variants, 5);
    expect(tuning.recommendation).toHaveLength(2);
    for (const row of tuning.recommendation) {
      expect(isTuningRowInVariants(row, variants)).toBe(true);
      expect(row.evidenceIds[0]).toMatch(/^variant:/);
    }
  });

  it("buildTuningFromVariants dedupes identical cardId/from/to rows", () => {
    const duped = [
      variants[0]!,
      { ...variants[0]! },
      variants[1]!,
    ];
    const tuning = buildTuningFromVariants(duped, 5);
    expect(tuning.recommendation).toHaveLength(2);
    expect(
      new Set(
        tuning.recommendation.map(
          (r) => `${r.cardId}:${r.fromCopies}->${r.toCopies}`,
        ),
      ).size,
    ).toBe(2);
  });

  it("mergeGroqTuningReasons keeps server rows and only overlays matching reasons", () => {
    const server = buildTuningFromVariants(variants, 5);
    const merged = mergeGroqTuningReasons(server, {
      recommendation: [
        {
          cardId: "100",
          fromCopies: 3,
          toCopies: 2,
          changeReason: "Cut a brick extender without losing much access.",
          evidenceIds: [EvidenceIds.variant(100, 3, 2)],
        },
        {
          cardId: "999",
          fromCopies: 3,
          toCopies: 0,
          changeReason: "Invented forbidden cut",
          evidenceIds: ["variant:999:3->0"],
        },
      ],
      tradeoffs: ["Custom tradeoff"],
    });
    expect(merged.recommendation).toHaveLength(2);
    expect(merged.recommendation.every((r) => r.cardId !== "999")).toBe(true);
    expect(merged.recommendation[0]?.changeReason).toContain("brick extender");
    expect(merged.tradeoffs).toEqual(["Custom tradeoff"]);
  });
});

describe("coach guardrails — evidence allowlist", () => {
  it("strips unknown evidence IDs and lowers confidence", () => {
    const allowed = collectAllowedEvidenceIds({
      variantEvidenceIds: [EvidenceIds.variant(1, 3, 2)],
      cardEvidenceIds: [EvidenceIds.card(42)],
    });
    const scrubbed = sanitizeCoachEvidence(
      {
        mode: "qa",
        answer: "Test answer grounded in facts.",
        confidence: "high",
        limitations: [],
        evidence: [
          {
            claim: "Valid consistency",
            evidenceIds: [EvidenceIds.consistency, "facts.invented"],
          },
          {
            claim: "Hallucinated metric",
            evidenceIds: ["facts.winRate"],
          },
          {
            claim: "Valid card cite",
            evidenceIds: [EvidenceIds.card(42)],
          },
        ],
      },
      allowed,
    );
    expect(scrubbed.evidence).toHaveLength(2);
    expect(scrubbed.evidence[0]?.evidenceIds).toEqual([
      EvidenceIds.consistency,
    ]);
    expect(scrubbed.confidence).toBe("medium");
    expect(
      scrubbed.limitations.some((l) =>
        l.includes("limited to verified deck and card data") ||
        l.includes("citations were cleaned") ||
        l.includes("evidence IDs were removed"),
      ),
    ).toBe(true);
  });
});

describe("play_line evidence hints", () => {
  it("prioritizes facts.combos for play_line focus", () => {
    expect(evidenceHintsForQaFocus("play_line")).toContain(EvidenceIds.combos);
    expect(evidenceHintsForQaFocus("play_line")[0]).toBe(EvidenceIds.combos);
  });
});

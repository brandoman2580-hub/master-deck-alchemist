/**
 * Master Rank Coach — player voice, slang routing, restrictions, denylist.
 */
import {
  classifyIntentHeuristic,
  resolveAssistantMode,
} from "@/lib/engine/mode-router";
import {
  formatPlayerChangeReason,
  formatTuneFallbackAnswer,
  playerTextPassesMetricDenylist,
} from "@/lib/engine/player-voice";
import {
  buildSlangHintBlock,
  containsEngineerMetrics,
  slangIntentTagsFromQuestion,
  stripEngineerMetrics,
} from "@/lib/engine/yugioh-slang";
import {
  detectPackageLockConflicts,
  extractRestrictions,
} from "@/lib/engine/restrictions";
import { buildTuningFromVariants } from "@/lib/engine/coach-guardrails";
import { EvidenceIds } from "@/lib/engine/assistant-contract";
import { render, screen } from "@testing-library/react";
import { EvidenceDisclosure } from "@/components/mda/workshop-strategist/EvidenceDisclosure";
import { TuningActionRow } from "@/components/mda/workshop-strategist/TuningActionRow";

describe("Master Rank player voice", () => {
  it("maps near-neutral cut deltas to slang without raw Δ dumps", () => {
    const reason = formatPlayerChangeReason({
      cardName: "Crimson Gaia",
      fromCopies: 1,
      toCopies: 0,
      factsDelta: {
        starterAccess: -0.0153,
        brickRate: -0.0015,
        oneInterruptionSurvival: -0.01,
      },
    });
    expect(playerTextPassesMetricDenylist(reason)).toBe(true);
    expect(containsEngineerMetrics(reason)).toBe(false);
    expect(reason.toLowerCase()).toMatch(/trim|cut|opener|consistency|brick/);
  });

  it("tune fallback ranks cuts in slang for 42→40 style asks", () => {
    const answer = formatTuneFallbackAnswer(
      [
        {
          cardName: "Crimson Gaia",
          fromCopies: 1,
          toCopies: 0,
          factsDelta: {
            starterAccess: -0.01,
            brickRate: -0.001,
            oneInterruptionSurvival: 0,
          },
        },
        {
          cardName: "Bystial Druiswurm",
          fromCopies: 1,
          toCopies: 0,
          factsDelta: {
            starterAccess: 0.006,
            brickRate: 0.002,
            oneInterruptionSurvival: -0.02,
          },
        },
      ],
      42,
    );
    expect(answer).toMatch(/42/);
    expect(answer).toMatch(/Crimson Gaia/);
    expect(playerTextPassesMetricDenylist(answer)).toBe(true);
  });

  it("buildTuningFromVariants never emits Validated Δ strings", () => {
    const tuning = buildTuningFromVariants([
      {
        cardId: "98173209",
        cardName: "Crimson Gaia",
        fromCopies: 1,
        toCopies: 0,
        evidenceId: EvidenceIds.variant("98173209", 1, 0),
        factsDelta: {
          starterAccess: -0.0153,
          brickRate: -0.0015,
          oneInterruptionSurvival: -0.029,
        },
      },
    ]);
    const reason = tuning.recommendation[0]?.changeReason ?? "";
    expect(reason).not.toMatch(/Δstarter|Validated/);
    expect(playerTextPassesMetricDenylist(reason)).toBe(true);
  });
});

describe("Master Rank slang literacy", () => {
  it("pitch + bricking on Lair routes to tune_copies", () => {
    const q =
      "I keep bricking on my Lair package, what should I pitch?";
    expect(resolveAssistantMode("auto", q)).toBe("tune_copies");
    const intent = classifyIntentHeuristic(q);
    expect(intent.inferred_mode).toBe("tune_copies");
    expect(intent.optimization_target).toBe("brick_rate");
    expect(slangIntentTagsFromQuestion(q)).toEqual(
      expect.arrayContaining(["consistency", "tune_copies"]),
    );
    expect(buildSlangHintBlock(q)).toMatch(/SLANG/);
  });

  it("choke ask routes to qa play_line or resilience", () => {
    const q = "where's the choke if they Ash?";
    expect(resolveAssistantMode("auto", q)).toBe("qa");
    const intent = classifyIntentHeuristic(q);
    expect(intent.inferred_mode).toBe("qa");
    expect(["play_line", "resilience"]).toContain(intent.qa_focus);
  });

  it("garnet ask routes to qa construction", () => {
    const intent = classifyIntentHeuristic("is this a garnet?");
    expect(intent.inferred_mode).toBe("qa");
    expect(intent.qa_focus).toBe("construction");
  });

  it("board breakers going second routes to discover_synergy", () => {
    expect(
      resolveAssistantMode(
        "auto",
        "need more board breakers going second",
      ),
    ).toBe("discover_synergy");
  });

  it("anti-synergy lock language sets qa_focus", () => {
    const intent = classifyIntentHeuristic(
      "Does the Crimson Resonator lock anti-synergy with Lair?",
    );
    expect(intent.inferred_mode).toBe("qa");
    expect(intent.qa_focus).toBe("anti_synergy");
  });
});

describe("Master Rank restrictions", () => {
  it("extracts Extra Deck lock from Crimson Resonator-style text", () => {
    const locks = extractRestrictions([
      {
        id: 401,
        name: "Crimson Resonator",
        desc:
          "You can only Special Summon DARK Dragon Synchro Monsters from your Extra Deck for the rest of this turn.",
      },
    ]);
    expect(locks.length).toBeGreaterThan(0);
    expect(locks[0]?.appliesTo).toBe("extra_deck");
    expect(locks[0]?.lockSummary.toLowerCase()).toMatch(/extra deck|dark dragon/);
  });

  it("flags PACKAGE_LOCK_CONFLICT when Lair + ED lock coexist", () => {
    const restrictions = extractRestrictions([
      {
        id: 401,
        name: "Crimson Resonator",
        desc:
          "You can only Special Summon DARK Dragon Synchro Monsters from your Extra Deck.",
      },
    ]);
    const collisions = detectPackageLockConflicts({
      restrictions,
      deckCardNames: ["Lair of Darkness", "Crimson Resonator"],
    });
    expect(collisions.some((c) => c.code === "PACKAGE_LOCK_CONFLICT")).toBe(
      true,
    );
  });
});

describe("Master Rank UX denylist", () => {
  it("EvidenceDisclosure summary is Why I'm saying this", () => {
    render(
      <EvidenceDisclosure
        limitations={["Copy suggestions are estimates."]}
        evidence={[
          {
            claim: "Your openers are already dialed.",
            evidenceIds: [EvidenceIds.consistency],
          },
        ]}
      />,
    );
    expect(screen.getByText(/Why I'm saying this/i)).toBeInTheDocument();
    expect(screen.queryByText(/Grounded in facts/i)).not.toBeInTheDocument();
  });

  it("TuningActionRow shows player changeReason without Δstarter", () => {
    const reason = formatPlayerChangeReason({
      fromCopies: 1,
      toCopies: 0,
      factsDelta: {
        starterAccess: -0.01,
        brickRate: 0,
        oneInterruptionSurvival: 0,
      },
    });
    render(
      <TuningActionRow
        cardName="Crimson Gaia"
        recommendation={{
          cardId: "1",
          fromCopies: 1,
          toCopies: 0,
          changeReason: reason,
          evidenceIds: [EvidenceIds.variant(1, 1, 0)],
        }}
        onApply={() => undefined}
      />,
    );
    expect(screen.getByText(/Crimson Gaia/)).toBeInTheDocument();
    expect(screen.queryByText(/Δstarter/)).not.toBeInTheDocument();
  });

  it("stripEngineerMetrics cleans metric soup", () => {
    const cleaned = stripEngineerMetrics(
      "Cut Gaia. Validated Δstarter=-0.0153, Δbrick=-0.0015, Δsurvive=-0.02. starterAccess ≈ 0.92",
    );
    expect(containsEngineerMetrics(cleaned)).toBe(false);
  });
});

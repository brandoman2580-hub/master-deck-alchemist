/**
 * Phase 5 golden fixtures — per-mode evals for the live Facts Brain Strategist.
 * No live Supabase / Groq. Asserts grounding, ban/lock respect, evidence IDs, tone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EvidenceIds,
  buildTuningFromVariants,
  canAddCardUnderBanlist,
  collectAllowedEvidenceIds,
  containsCasualCoachTone,
  detectPackageLockConflicts,
  extractRestrictions,
  formatPlayerChangeReason,
  mentionsInventedQuantitativeClaims,
  parseDeckCoachResponse,
  resolveAssistantMode,
  sanitizeCoachEvidence,
  verifyCardNamesAgainstLibrary,
  banStatusAgainstMap,
} from "@/lib/engine";

const ROOT = join(process.cwd());

const LIBRARY = [
  { id: 8492961, name: "Lair of Darkness" },
  { id: 13708425, name: "Red Resonator" },
  { id: 70902743, name: "Red Dragon Archfiend" },
  { id: 14558127, name: "Ash Blossom & Joyous Spring" },
  { id: 27204311, name: "Nibiru, the Primal Being" },
  { id: 97268402, name: "Effect Veiler" },
];

const BANLIST: Record<string, string> = {
  'Maxx "C"': "Forbidden",
  "Dimension Shifter": "Limited",
  "Called by the Grave": "Semi-Limited",
  "Hot Red Dragon Archfiend King Calamity": "Forbidden",
};

/** One golden ask per live coach mode. */
const GOLDEN_ASKS = [
  {
    mode: "qa" as const,
    question: "Why is my deck bricking on openers?",
    inventedName: "Ultra Neo Tomahawk Resonator Deluxe",
  },
  {
    mode: "tune_copies" as const,
    question: "Should I cut Ash Blossom to 2 for brick rate?",
    inventedName: "Phantom Ash Blossom EX",
  },
  {
    mode: "discover_synergy" as const,
    question: "Show me DARK Fiend searchers for this list",
    inventedName: "Fiend Tutor Omega Prime",
  },
  {
    mode: "optimize" as const,
    question: "Convert Lair into RDA",
    inventedName: "Fake Calamity Dragon That Does Not Exist",
  },
] as const;

describe("Phase 5 golden fixtures — mode routing", () => {
  it.each(GOLDEN_ASKS)(
    "routes $mode ask → $mode",
    ({ mode, question }) => {
      expect(resolveAssistantMode("auto", question)).toBe(mode);
    },
  );
});

describe("Phase 5 golden fixtures — no invented names", () => {
  it.each(GOLDEN_ASKS)(
    "$mode rejects invented card names from the ask context",
    ({ inventedName }) => {
      const result = verifyCardNamesAgainstLibrary(
        ["Ash Blossom & Joyous Spring", inventedName, "Red Resonator"],
        LIBRARY,
      );
      expect(result.found.map((c) => c.name)).toEqual([
        "Ash Blossom & Joyous Spring",
        "Red Resonator",
      ]);
      expect(result.notFound).toContain(inventedName);
    },
  );
});

describe("Phase 5 golden fixtures — ban / lock respect", () => {
  it("forbidden cards cannot be recommended as adds", () => {
    expect(
      canAddCardUnderBanlist({
        cardId: 1,
        cardName: 'Maxx "C"',
        copiesInDeck: 0,
        banlist: BANLIST,
      }),
    ).toBe(false);

    const [calamity] = banStatusAgainstMap(
      [{ id: 99, name: "Hot Red Dragon Archfiend King Calamity" }],
      BANLIST,
    );
    expect(calamity.maxCopies).toBe(0);
  });

  it("limited cards stop at 1 copy", () => {
    expect(
      canAddCardUnderBanlist({
        cardId: 2,
        cardName: "Dimension Shifter",
        copiesInDeck: 1,
        banlist: BANLIST,
      }),
    ).toBe(false);
    expect(
      canAddCardUnderBanlist({
        cardId: 2,
        cardName: "Dimension Shifter",
        copiesInDeck: 0,
        banlist: BANLIST,
      }),
    ).toBe(true);
  });

  it("extra-deck lock text surfaces as a restriction fact", () => {
    const locks = extractRestrictions([
      {
        id: 42,
        name: "Locking Boss",
        desc: "You can only Special Summon DARK Dragon monsters from your Extra Deck.",
        type: "Link Monster",
      },
    ]);
    expect(locks.length).toBeGreaterThan(0);
    expect(locks[0]?.appliesTo).toBe("extra_deck");
    expect(locks[0]?.evidenceId).toBe(EvidenceIds.restriction(42));

    const conflicts = detectPackageLockConflicts({
      restrictions: locks,
      deckCardNames: ["Lair of Darkness", "Locking Boss"],
    });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]?.code).toBe("PACKAGE_LOCK_CONFLICT");
  });
});

describe("Phase 5 golden fixtures — evidence IDs", () => {
  it("tune_copies variants only emit variant:* + facts.consistency evidence", () => {
    const tuning = buildTuningFromVariants([
      {
        cardId: "14558127",
        cardName: "Ash Blossom & Joyous Spring",
        fromCopies: 3,
        toCopies: 2,
        evidenceId: EvidenceIds.variant(14558127, 3, 2),
        factsDelta: {
          starterAccess: -0.01,
          brickRate: -0.02,
          oneInterruptionSurvival: 0,
        },
      },
    ]);
    const ids = tuning.recommendation[0]!.evidenceIds;
    expect(ids).toContain(EvidenceIds.variant(14558127, 3, 2));
    expect(ids).toContain(EvidenceIds.consistency);
    expect(ids.every((id) => id.startsWith("variant:") || id.startsWith("facts."))).toBe(
      true,
    );
  });

  it("sanitizeCoachEvidence drops unknown evidence IDs", () => {
    const allowed = collectAllowedEvidenceIds({
      variantEvidenceIds: [EvidenceIds.variant(14558127, 3, 2)],
      conditionEvidenceIds: [EvidenceIds.condition("tribute_opponent_for_cost")],
      cardEvidenceIds: [EvidenceIds.card(13708425)],
    });

    const raw = parseDeckCoachResponse({
      mode: "tune_copies",
      answer:
        "Cut Ash Blossom to 2 copies. That trim slightly reduces brick on openers without inventing win rates.",
      confidence: "high",
      recommendations: [],
      evidence: [
        {
          claim: "Ash cut is supported by copy variants",
          evidenceIds: [
            EvidenceIds.variant(14558127, 3, 2),
            EvidenceIds.consistency,
            "hallucinated.metric.99",
          ],
        },
        {
          claim: "Invented source",
          evidenceIds: ["made.up.id", "also.fake"],
        },
      ],
      limitations: [],
    });
    expect(raw).not.toBeNull();

    const scrubbed = sanitizeCoachEvidence(raw!, allowed);
    const allIds = scrubbed.evidence.flatMap((e) => e.evidenceIds);
    expect(allIds).toContain(EvidenceIds.variant(14558127, 3, 2));
    expect(allIds).not.toContain("hallucinated.metric.99");
    expect(allIds).not.toContain("made.up.id");
    expect(scrubbed.confidence).not.toBe("high");
  });
});

describe("Phase 5 golden fixtures — professional tone smoke", () => {
  it("flags casual peer filler and allows competitive YGO terms", () => {
    expect(containsCasualCoachTone('Yo bro, solid pick — let\'s slide this out')).toBe(
      true,
    );
    expect(
      containsCasualCoachTone(
        "Your brick rate is elevated; prefer hand traps over additional extenders going first.",
      ),
    ).toBe(false);
  });

  it("player-voice change reasons stay professional", () => {
    const reason = formatPlayerChangeReason({
      cardName: "Ash Blossom & Joyous Spring",
      fromCopies: 3,
      toCopies: 2,
      factsDelta: {
        starterAccess: -0.01,
        brickRate: -0.03,
        oneInterruptionSurvival: 0,
      },
      packageHint: "hand trap",
    });
    expect(containsCasualCoachTone(reason)).toBe(false);
    expect(mentionsInventedQuantitativeClaims(reason)).toBe(false);
    expect(reason.toLowerCase()).not.toMatch(/\d+\.\d{3,}/);
  });

  it.each(GOLDEN_ASKS)(
    "$mode sample answer uses competitive language without casual filler",
    ({ mode }) => {
      const samples: Record<(typeof GOLDEN_ASKS)[number]["mode"], string> = {
        qa: "Opening consistency is weak because starter density is low relative to garnets in the Main Deck.",
        tune_copies:
          "Cut Ash Blossom from 3 to 2. That is the cleanest trim with minimal impact on openers and slightly less brick.",
        discover_synergy:
          "These DARK Fiend searchers satisfy a deck-to-hand condition already present on your list.",
        optimize:
          "A Resonator bridge is available from curated combo templates; do not invent Extra Deck lines outside those graphs.",
      };
      const answer = samples[mode];
      expect(containsCasualCoachTone(answer)).toBe(false);
      expect(mentionsInventedQuantitativeClaims(answer)).toBe(false);
    },
  );

  it("live coach-response prompt bans casual filler", () => {
    const src = readFileSync(
      join(ROOT, "supabase/functions/strategist/coach-response.ts"),
      "utf8",
    );
    expect(src).toMatch(/professional/i);
    expect(src).toMatch(/Do NOT use casual filler/);
    expect(src).toMatch(/"Yo"/);
    expect(src).toMatch(/Never invent names/);
  });
});


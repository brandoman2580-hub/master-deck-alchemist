/**
 * Phase 3 — shared role heuristics + curated weight coverage.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { detectCardRole } from "@/lib/analysis/cardRoleDetector";
import {
  detectHeuristicRoleSlugs,
  heuristicSlugsToCardRoleTags,
  measureWeightCoverage,
} from "@/lib/engine/card-role-heuristics";
import { tagMainDeckForConsistency } from "@/lib/engine/tag-main-deck";
import type { StrategyWeightRow } from "@/lib/engine/diagnostics";
import type { Card } from "@/types/card";

function card(partial: Partial<Card> & { id: number; name: string }): Card {
  return {
    type: "Effect Monster",
    desc: "",
    ...partial,
  } as Card;
}

describe("detectHeuristicRoleSlugs (shared)", () => {
  it("tags Ash-like text as hand_trap interruption", () => {
    const ash = card({
      id: 1,
      name: "Ash Blossom & Joyous Spring",
      desc: "During either player's turn (Quick Effect): You can discard this card; negate the activation.",
    });
    const slugs = detectHeuristicRoleSlugs(ash);
    expect(slugs).toContain("hand_trap");
    expect(heuristicSlugsToCardRoleTags(slugs)).toContain("Hand Trap");
    expect(detectCardRole(ash)).toContain("interruption");
  });

  it("tags board clearers and ED bosses with multi-labels", () => {
    const breaker = card({
      id: 2,
      name: "Lightning Storm",
      type: "Spell Card",
      desc: "Destroy all Attack Position monsters your opponent controls, or all Spells/Traps.",
    });
    expect(detectHeuristicRoleSlugs(breaker)).toContain("board_breaker");

    const boss = card({
      id: 3,
      name: "Accesscode Talker",
      type: "Link Monster",
      atk: 2300,
      desc: "Negate the effects of all face-up cards your opponent currently controls.",
    });
    expect(detectHeuristicRoleSlugs(boss)).toContain("endboard");
  });

  it("tags floodgates as lock", () => {
    const drain = card({
      id: 4,
      name: "Skill Drain",
      type: "Continuous Trap",
      desc: "Negate the effects of all face-up monsters while this card is face-up. Neither player can...",
    });
    // "neither player can" may not be in this truncated desc — use explicit lock text
    const rivalry = card({
      id: 5,
      name: "Rivalry of Warlords",
      type: "Continuous Trap",
      desc: "Each player can only control 1 Type of monster. Send all other face-up monsters they control to the GY.",
    });
    expect(detectHeuristicRoleSlugs(rivalry)).toContain("lock");
    expect(detectHeuristicRoleSlugs(drain).length).toBeGreaterThan(0);
  });
});

describe("measureWeightCoverage", () => {
  it("reports curated vs heuristic-only ratio for a deck", () => {
    const weights: StrategyWeightRow[] = [
      {
        cardId: "1",
        format: "MASTER_DUEL",
        strategy: "Control",
        role: "Hand Trap",
        synergyWeight: 0.9,
        isBoss: false,
      },
      {
        cardId: "2",
        format: "MASTER_DUEL",
        strategy: "Combo",
        role: "Starter",
        synergyWeight: 0.8,
        isBoss: false,
      },
    ];
    const stats = measureWeightCoverage(
      [1, 1, 2, 3, 4],
      weights,
      "MASTER_DUEL",
    );
    expect(stats.totalCards).toBe(4);
    expect(stats.curatedCards).toBe(2);
    expect(stats.heuristicOnlyCards).toBe(2);
    expect(stats.curatedCoverageRatio).toBeCloseTo(0.5);
  });
});

describe("tagMainDeckForConsistency prefers curated weights", () => {
  it("uses Hand Trap weight over heuristic when present", () => {
    const ash = card({
      id: 14558127,
      name: "Ash Blossom & Joyous Spring",
      desc: "Quick Effect discard negate",
    });
    const filler = card({
      id: 99,
      name: "Unknown Engine Piece",
      desc: "Special Summon this card from your hand.",
    });
    const weights: StrategyWeightRow[] = [
      {
        cardId: "14558127",
        format: "TCG",
        strategy: "Control",
        role: "Hand Trap",
        synergyWeight: 0.95,
        isBoss: false,
      },
    ];
    const tagged = tagMainDeckForConsistency([ash, filler], "TCG", weights);
    const ashTagged = tagged.find((t) => t.id === 14558127);
    const fillerTagged = tagged.find((t) => t.id === 99);
    expect(ashTagged?.isHandTrap).toBe(true);
    expect(fillerTagged?.isExtender).toBe(true);
  });
});

describe("facts_brain_phase3_role_weights_expand migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260916000000_facts_brain_phase3_role_weights_expand.sql",
    ),
    "utf8",
  );

  it("expands card_strategy_weights without creating card_roles", () => {
    expect(sql).toContain("INSERT INTO card_strategy_weights");
    expect(sql).toContain("Board Breaker");
    expect(sql).toContain("Endboard");
    expect(sql).toContain("Lock");
    expect(sql).toContain("Accesscode Talker");
    expect(sql).not.toContain("CREATE TABLE");
    expect(sql).not.toMatch(/\bcard_roles\b/);
  });
});

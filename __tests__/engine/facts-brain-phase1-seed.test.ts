import { readFileSync } from "fs";
import { join } from "path";

describe("facts_brain_phase1_seed migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260908010000_facts_brain_phase1_seed.sql",
    ),
    "utf8",
  );

  it("seeds archetype strategies for both formats", () => {
    expect(sql).toContain("INSERT INTO archetype_strategies");
    expect(sql).toContain("CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL'))");
    expect(sql).toContain("Snake-Eye");
  });

  it("seeds staple card_strategy_weights via cards.name join", () => {
    expect(sql).toContain("INSERT INTO card_strategy_weights");
    expect(sql).toContain("Ash Blossom & Joyous Spring");
    expect(sql).toContain("JOIN cards c ON c.name = v.card_name");
  });
});

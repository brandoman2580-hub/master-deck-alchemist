import { readFileSync } from "fs";
import { join } from "path";

/**
 * Guards the Phase 0 forward migration so CI fails if tables/enums are
 * renamed or dropped from the checked-in SQL without an intentional update.
 */
describe("facts_brain_phase0 migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260908000000_facts_brain_phase0.sql",
    ),
    "utf8",
  );

  it("defines both format-aware strategy and cache tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS archetype_strategies");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS card_strategy_weights");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS combo_templates");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS deck_analysis_cache");
  });

  it("scopes formats to TCG and MASTER_DUEL", () => {
    expect(sql).toContain("CHECK (format IN ('TCG', 'MASTER_DUEL'))");
  });

  it("creates play strategy and role enums", () => {
    expect(sql).toContain("CREATE TYPE yugioh_play_strategy AS ENUM");
    expect(sql).toContain("CREATE TYPE card_role_tag AS ENUM");
  });
});

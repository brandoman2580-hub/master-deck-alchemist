import { readFileSync } from "fs";
import { join } from "path";

describe("facts_brain_phase4_combo_templates migration", () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20260908030000_facts_brain_phase4_combo_templates.sql",
    ),
    "utf8",
  );

  it("expands combo_templates for additional archetypes on both formats", () => {
    expect(sql).toContain("INSERT INTO combo_templates");
    expect(sql).toContain("CROSS JOIN (VALUES ('TCG'), ('MASTER_DUEL'))");
    expect(sql).toContain("Spright");
    expect(sql).toContain("Purrely");
    expect(sql).toContain("Mathmech");
    expect(sql).toContain("Sky Striker");
    expect(sql).toContain("Dragon Link");
    expect(sql).toContain("Tri-Brigade");
    expect(sql).toContain("Prank-Kids");
    expect(sql).toContain("Floowandereeze");
  });

  it("keeps graph JSON with nodes and edges for compiled lines", () => {
    expect(sql).toContain('"nodes"');
    expect(sql).toContain('"edges"');
    expect(sql).toContain("endboardSummary");
  });
});

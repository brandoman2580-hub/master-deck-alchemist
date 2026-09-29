import { workshopGradeFromAxes } from "@/lib/workshop/grade";
import { emptyWorkshopGradeAxes } from "@/lib/engine/grade";
import type { WorkshopGradeAxes } from "@/lib/engine/types";

describe("workshopGradeFromAxes", () => {
  it("maps Facts Brain axes onto chrome score labels", () => {
    const axes: WorkshopGradeAxes = {
      ...emptyWorkshopGradeAxes(),
      consistency: 81,
      power: 64,
      resilience: 70,
      disruption: 55,
      letter: "B",
      synergyFactor: 1.05,
      formatRulePack: "tcgTournament",
    };
    const grade = workshopGradeFromAxes(axes);
    expect(grade.letter).toBe("B");
    expect(grade.scores.map((s) => s.label)).toEqual([
      "Consistency",
      "Resilience",
      "Power",
      "Disruption",
    ]);
    expect(grade.scores.find((s) => s.label === "Consistency")?.value).toBe(81);
    expect(grade.synergyFactor).toBe(1.05);
    expect(grade.formatRulePack).toBe("tcgTournament");
  });

  it("tolerates pre-0.2.0 cached grades without breakdown", () => {
    const legacy = {
      consistency: 70,
      power: 60,
      resilience: 55,
      disruption: 50,
      letter: "C",
    } as WorkshopGradeAxes;
    const grade = workshopGradeFromAxes(legacy);
    expect(grade.letter).toBe("C");
    expect(grade.formatPackNotes).toEqual([]);
    expect(grade.breakdown?.resilience).toEqual([]);
    expect(grade.synergyFactor).toBe(1);
  });
});

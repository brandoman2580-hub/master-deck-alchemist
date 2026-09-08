import { workshopGradeFromAxes } from "@/lib/workshop-grade";
import type { WorkshopGradeAxes } from "@/lib/engine/types";

describe("workshopGradeFromAxes", () => {
  it("maps Facts Brain axes onto chrome score labels", () => {
    const axes: WorkshopGradeAxes = {
      consistency: 81,
      power: 64,
      resilience: 70,
      disruption: 55,
      letter: "B",
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
  });
});

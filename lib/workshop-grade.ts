export type WorkshopGradeScore = {
  label: string;
  value: number;
};

export type WorkshopGrade = {
  letter: string;
  scores: WorkshopGradeScore[];
};

/** Placeholder grade derived from deck size until real analytics land. */
export function gradeFromCounts(main: number, extra: number): WorkshopGrade {
  const density = Math.min(100, Math.round((main / 40) * 100));
  const extraScore = Math.min(100, Math.round((extra / 15) * 100));
  const consistency = Math.round((density + extraScore) / 2);
  const letter =
    consistency >= 90
      ? "S"
      : consistency >= 75
        ? "A"
        : consistency >= 60
          ? "B"
          : "C";

  return {
    letter,
    scores: [
      { label: "Consistency", value: consistency },
      { label: "Resilience", value: Math.max(40, consistency - 5) },
      { label: "Power", value: Math.max(45, extraScore) },
      { label: "Disruption", value: Math.max(35, Math.round(consistency * 0.9)) },
    ],
  };
}

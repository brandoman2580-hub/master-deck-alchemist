export type WorkshopGradeScore = {
  label: string;
  value: number;
};

export type WorkshopGrade = {
  letter: string;
  scores: WorkshopGradeScore[];
};

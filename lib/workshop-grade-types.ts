export type WorkshopGradeScore = {
  label: string;
  value: number;
};

export type WorkshopGradeBreakdownLine = {
  key: string;
  label: string;
  value: number;
  note?: string;
};

export type WorkshopGrade = {
  letter: string;
  scores: WorkshopGradeScore[];
  /** Present when grade comes from Facts Brain (schema ≥ 0.2.0). */
  synergyFactor?: number;
  formatRulePack?: string;
  formatPackNotes?: string[];
  synergyNotes?: string[];
  breakdown?: {
    consistency: WorkshopGradeBreakdownLine[];
    power: WorkshopGradeBreakdownLine[];
    resilience: WorkshopGradeBreakdownLine[];
    disruption: WorkshopGradeBreakdownLine[];
  };
};

export interface Recommendation {
  cardId: string;
  cardName?: string;
  action: string;
  reason: string;
  impactEst: number;
  synergyScore?: number;
  banned?: boolean;
  priority?: "must-have" | "highly-recommended" | "good-option" | "situational";
}

export function groupRecommendationsByPriority(
  recommendations: Recommendation[]
): {
  "must-have": Recommendation[];
  "highly-recommended": Recommendation[];
  "good-option": Recommendation[];
  "situational": Recommendation[];
} {
  return {
    "must-have": recommendations.filter(
      (r) =>
        r.priority === "must-have" ||
        (!r.priority && r.impactEst >= 0.8)
    ),
    "highly-recommended": recommendations.filter(
      (r) =>
        r.priority === "highly-recommended" ||
        (!r.priority && r.impactEst >= 0.6 && r.impactEst < 0.8)
    ),
    "good-option": recommendations.filter(
      (r) =>
        r.priority === "good-option" ||
        (!r.priority && r.impactEst >= 0.5 && r.impactEst < 0.6)
    ),
    "situational": recommendations.filter(
      (r) =>
        r.priority === "situational" ||
        (!r.priority && r.impactEst < 0.5)
    ),
  };
}

export function getPriorityBadge(impactEst: number): {
  label: string;
  className: string;
} {
  if (impactEst >= 0.8) {
    return {
      label: "Must-Have",
      className: "bg-red-500/20 text-red-400 border-red-500/50",
    };
  }
  if (impactEst >= 0.6) {
    return {
      label: "Highly Recommended",
      className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
    };
  }
  if (impactEst >= 0.5) {
    return {
      label: "Good Option",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    };
  }
  return {
    label: "Situational",
    className: "bg-slate-500/20 text-slate-400 border-slate-500/50",
  };
}

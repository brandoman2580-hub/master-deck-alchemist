export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  recommendations?: Recommendation[];
}

export interface Recommendation {
  cardId: number;
  cardName: string;
  reason: string;
  priority: "high" | "medium" | "low";
  canAdd: boolean;
  impactEst?: number;
  synergyScore?: number;
}

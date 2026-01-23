"use client";

import { motion } from "framer-motion";
import { Target, Star, TrendingUp, Plus } from "lucide-react";
import { Button } from "../button";
import { Badge } from "../badge";
import type { Card } from "@/types/card";
import type { Recommendation } from "./priority-helpers";

interface PriorityGroupRendererProps {
  priorityGroups: {
    "must-have": Recommendation[];
    "highly-recommended": Recommendation[];
    "good-option": Recommendation[];
    "situational": Recommendation[];
  };
  cardMap: Map<number, Card>;
  deckCards?: {
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
  };
  addedCardIds: Set<string>;
  addingCardIds: Set<string>;
  onAddCard?: (cardId: string) => void;
  onRemoveCard?: (cardId: string) => void;
  onPreviewSuggestion?: (suggestionId: string, cardId?: string) => void;
  onAskFollowUp?: (prompt: string) => void;
}

export function PriorityGroupRenderer({
  priorityGroups,
  cardMap,
  addedCardIds,
  onAddCard,
}: PriorityGroupRendererProps) {
  if (
    priorityGroups["must-have"].length === 0 &&
    priorityGroups["highly-recommended"].length === 0 &&
    priorityGroups["good-option"].length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Must-Have Recommendations */}
      {priorityGroups["must-have"].length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold text-slate-50">
                Must-Have Recommendations
              </h3>
              <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
                {priorityGroups["must-have"].length}
              </Badge>
            </div>
            {/* Bulk action: Add All Must-Haves */}
            {onAddCard &&
              priorityGroups["must-have"].some(
                (r) => r.action === "add" && !r.banned
              ) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    priorityGroups["must-have"]
                      .filter(
                        (r) =>
                          r.action === "add" &&
                          !r.banned &&
                          !addedCardIds.has(r.cardId)
                      )
                      .forEach((r) => onAddCard(r.cardId));
                  }}
                  className="border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add All (
                  {
                    priorityGroups["must-have"].filter(
                      (r) =>
                        r.action === "add" &&
                        !r.banned &&
                        !addedCardIds.has(r.cardId)
                    ).length
                  }
                  )
                </Button>
              )}
          </div>
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {priorityGroups["must-have"].map((rec, index) => {
              const card = rec.cardId
                ? cardMap.get(parseInt(rec.cardId, 10))
                : null;
              if (!card) return null;

              return (
                <motion.div
                  key={rec.cardId || index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Other Priority Groups */}
      {[
        {
          key: "highly-recommended" as const,
          label: "Highly Recommended",
          icon: Star,
        },
        { key: "good-option" as const, label: "Good Options", icon: TrendingUp },
      ].map(({ key, label, icon: Icon }) => {
        if (priorityGroups[key].length === 0) return null;

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Icon className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-slate-50">{label}</h3>
              <Badge variant="outline" className="border-cyan-500/50 text-cyan-400">
                {priorityGroups[key].length}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-2">
              {priorityGroups[key].map((rec, index) => {
                const card = rec.cardId
                  ? cardMap.get(parseInt(rec.cardId, 10))
                  : null;
                if (!card) return null;

                return (
                  <motion.div
                    key={rec.cardId || index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CardImage } from "@/components/ui/card-image";
import {
  Plus,
  Eye,
  ChevronDown,
  Loader2,
  AlertCircle,
  Sparkles,
  X,
} from "lucide-react";
import { Card } from "../../types/card";
import { Badge } from "./badge";
import { CardPreview } from "./card-preview";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";

interface EnhancedRecommendationCardProps {
  recommendation: {
    cardId: string;
    cardName?: string;
    action: string;
    reason: string;
    impactEst: number;
    synergyScore?: number;
    banned?: boolean;
    priority?: "must-have" | "highly-recommended" | "good-option" | "situational";
    evidence?: string[];
  };
  card: Card;
  onAdd?: (cardId: string) => void;
  onRemove?: (cardId: string) => void;
  onPreview?: (cardId: string) => void;
  isAdding?: boolean;
  wasAdded?: boolean;
  priorityBadge: {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  };
}

export function EnhancedRecommendationCard({
  recommendation,
  card,
  onAdd,
  onRemove,
  onPreview,
  isAdding = false,
  wasAdded = false,
  priorityBadge,
}: EnhancedRecommendationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const Icon = priorityBadge.icon;

  // Calculate impact percentage
  const impactPercentage = Math.round(recommendation.impactEst * 100);

  // Get impact bar gradient based on impact
  const getImpactGradient = () => {
    if (recommendation.impactEst >= 0.8) {
      return "from-red-500 to-red-400";
    } else if (recommendation.impactEst >= 0.6) {
      return "from-cyan-500 to-cyan-400";
    } else if (recommendation.impactEst >= 0.5) {
      return "from-blue-500 to-blue-400";
    }
    return "from-slate-500 to-slate-400";
  };

  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <motion.div
        className={`
          relative overflow-hidden
          rounded-xl
          bg-gradient-to-br from-slate-800/60 via-slate-700/40 to-slate-800/60
          border border-white/10
          backdrop-blur-xl
          shadow-lg
          transition-all duration-300
          ${isHovered ? 'border-white/20 shadow-xl shadow-cyan-500/10' : ''}
        `}
        whileHover={prefersReducedMotion ? {} : { y: -4, scale: 1.01 }}
        layout
      >
        {/* Animated background gradient on hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100"
          transition={{ duration: 0.3 }}
        />

        <div className="relative p-4 space-y-3">
          {/* Header with card image and name */}
          <div className="flex items-start gap-3">
            <motion.div
              className="relative flex-shrink-0"
              whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
            >
              <CardPreview card={card}>
                <div className="relative w-16 h-22 rounded-lg overflow-hidden border border-white/20 bg-slate-900/50 cursor-pointer group/image">
                  <CardImage
                    card={card}
                    alt={card.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover/image:scale-110"
                  />
                  {/* Master Duel rarity indicator overlay */}
                  {(card as any).rarity && (
                    <div className="absolute top-1 right-1">
                      <Badge className="text-[8px] px-1 py-0 bg-purple-500/80 border-purple-400/50">
                        {(card as any).rarity}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardPreview>
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white truncate">{card.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge className={priorityBadge.className}>
                      <Icon className="h-3 w-3 mr-1" />
                      {priorityBadge.label}
                    </Badge>
                    {recommendation.synergyScore !== undefined && recommendation.synergyScore > 0.3 && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Synergy: {Math.round(recommendation.synergyScore * 100)}%
                      </Badge>
                    )}
                    {recommendation.banned && (
                      <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/50 text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Banned
                      </Badge>
                    )}
                  </div>
                </div>
                <motion.button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                  whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  <ChevronDown
                    className={`h-4 w-4 text-white/60 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Impact bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">Expected Impact</span>
              <span className="text-white/80 font-medium">
                {impactPercentage}%
              </span>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${impactPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${getImpactGradient()}`}
              />
            </div>
          </div>

          {/* Expandable reason */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 border-t border-white/10">
                  <p className="text-sm text-white/80 leading-relaxed">
                    {recommendation.reason}
                  </p>
                  {recommendation.evidence && recommendation.evidence.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-white/60 font-medium">Evidence:</p>
                      <ul className="list-disc list-inside text-xs text-white/60 space-y-0.5">
                        {recommendation.evidence.map((evidence, i) => (
                          <li key={i}>{evidence}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            {recommendation.action === "add" && onAdd && !recommendation.banned && (
              <motion.button
                onClick={() => onAdd(recommendation.cardId)}
                disabled={isAdding || wasAdded}
                className={`
                  flex-1 px-4 py-2 rounded-lg
                  text-sm font-medium
                  transition-all duration-200
                  ${
                    wasAdded
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                whileHover={!wasAdded && !isAdding && !prefersReducedMotion ? { scale: 1.02 } : {}}
                whileTap={!wasAdded && !isAdding && !prefersReducedMotion ? { scale: 0.98 } : {}}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Adding...
                  </>
                ) : wasAdded ? (
                  <>
                    <AnimatedCheckmark className="h-4 w-4 inline mr-2" />
                    Added to Deck
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 inline mr-2" />
                    Add to Deck
                  </>
                )}
              </motion.button>
            )}
            {recommendation.action === "remove" && onRemove && (
              <motion.button
                onClick={() => onRemove(recommendation.cardId)}
                disabled={isAdding}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={!isAdding && !prefersReducedMotion ? { scale: 1.02 } : {}}
                whileTap={!isAdding && !prefersReducedMotion ? { scale: 0.98 } : {}}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Removing...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 inline mr-2" />
                    Remove from Deck
                  </>
                )}
              </motion.button>
            )}
            {onPreview && (
              <motion.button
                onClick={() => onPreview(recommendation.cardId)}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                aria-label="Preview card"
              >
                <Eye className="h-4 w-4 text-white/80" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

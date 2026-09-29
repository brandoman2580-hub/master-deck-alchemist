"use client";

import { CardImage } from "@/components/ui/card-image";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";

import { Card as CardType } from "@/types/card";
import { CardPreview } from "@/components/ui/card-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedCheckmark } from "@/components/ui/animated-checkmark";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface QuickSuggestionCardProps {
  card: CardType;
  reason: string;
  impact: number;
  onAdd: () => void;
  isAdding?: boolean;
  wasAdded?: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeImpact(impact: number): number {
  if (!Number.isFinite(impact)) return 0;
  if (impact <= 1) return clamp01(impact);
  if (impact <= 10) return clamp01(impact / 10);
  return clamp01(impact / 100);
}

export function QuickSuggestionCard({
  card,
  reason,
  impact,
  onAdd,
  isAdding = false,
  wasAdded = false,
}: QuickSuggestionCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const impactPct = Math.round(normalizeImpact(impact) * 100);

  return (
    <motion.div
      className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10 hover:border-white/15 transition-colors"
      whileHover={prefersReducedMotion ? {} : { y: -1 }}
    >
      <div className="flex items-start gap-3">
        <CardPreview card={card}>
          <div className="relative w-10 h-[58px] flex-shrink-0 cursor-pointer rounded-md overflow-hidden border border-white/10 bg-slate-950/40">
            <CardImage
              card={card}
              alt={card.name}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        </CardPreview>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm text-slate-100 truncate">
                {card.name}
              </div>
              <div className="mt-1 text-xs text-slate-300/80 line-clamp-2 leading-relaxed">
                {reason}
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant={wasAdded ? "default" : "outline"}
              disabled={isAdding || wasAdded}
              onClick={onAdd}
              className={cn(
                "h-7 px-2.5 text-xs shrink-0",
                wasAdded
                  ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-100"
                  : "border-white/10 hover:bg-white/10 hover:border-cyan-500/30 text-white/80",
              )}
            >
              {isAdding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : wasAdded ? (
                <>
                  <AnimatedCheckmark className="h-3.5 w-3.5" />
                  Added
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </>
              )}
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-cyan-500/30 text-cyan-200 bg-cyan-500/10"
            >
              Impact {impactPct}%
            </Badge>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-300/40"
                style={{ width: `${impactPct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


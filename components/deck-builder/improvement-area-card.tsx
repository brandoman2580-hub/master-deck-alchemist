"use client";

import { Card as CardType } from "@/types/card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickSuggestionCard } from "./quick-suggestion-card";
import { TrendingUp, Zap, Shield, Target, Sparkles, LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImprovementAreaType = 'consistency' | 'atk' | 'interruption' | 'meta' | 'synergy';

interface ImprovementAreaCardProps {
  area: ImprovementAreaType;
  score: number; // 0-10
  suggestions: Array<{
    card: CardType;
    reason: string;
    impact: number;
  }>;
  onAskAI: (question: string) => void;
  onAddCard: (card: CardType) => void;
  addedCards?: Set<string>;
  addingCardId?: string | null;
}

const AREA_CONFIG: Record<ImprovementAreaType, {
  title: string;
  icon: LucideIcon;
  question: string;
  color: string;
  gradient: string;
}> = {
  consistency: {
    title: 'Draw Consistency',
    icon: TrendingUp,
    question: 'How can I improve my deck\'s draw consistency and reduce bricking?',
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-blue-500/5',
  },
  atk: {
    title: 'ATK Power',
    icon: Zap,
    question: 'What cards can I add to increase my monster ATK power?',
    color: 'text-red-400',
    gradient: 'from-red-500/20 to-orange-500/5',
  },
  interruption: {
    title: 'Interruptions',
    icon: Shield,
    question: 'What interruption and defensive cards should I add?',
    color: 'text-indigo-400',
    gradient: 'from-indigo-500/20 to-violet-500/5',
  },
  meta: {
    title: 'Meta Countering',
    icon: Target,
    question: 'What cards counter the current meta threats?',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-teal-500/5',
  },
  synergy: {
    title: 'Hidden Synergies',
    icon: Sparkles,
    question: 'What hidden synergies and non-explicit support cards work with my deck?',
    color: 'text-purple-400',
    gradient: 'from-purple-500/20 to-pink-500/5',
  },
};

export function ImprovementAreaCard({
  area,
  score,
  suggestions,
  onAskAI,
  onAddCard,
  addedCards = new Set(),
  addingCardId = null,
}: ImprovementAreaCardProps) {
  const config = AREA_CONFIG[area];
  const statusColor = score >= 8 ? 'bg-green-500/20 text-green-400 border-green-500/30' : score >= 5 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <Card className="bg-slate-900/60 border-white/10 overflow-hidden relative group hover:border-white/20 transition-all">
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
      
      <CardHeader className="pb-3 pt-4 px-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md bg-white/5 border border-white/10 ${config.color}`}>
              <config.icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-medium text-slate-200">{config.title}</CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-xs font-mono px-2 h-5", statusColor)}>
            {score}/10
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 pb-4 relative z-10 space-y-4">
        {suggestions.length > 0 ? (
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <QuickSuggestionCard
                key={suggestion.card.id || index}
                card={suggestion.card}
                reason={suggestion.reason}
                impact={suggestion.impact}
                onAdd={() => onAddCard(suggestion.card)}
                isAdding={addingCardId === suggestion.card.id.toString()}
                wasAdded={addedCards.has(suggestion.card.id.toString())}
              />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-xs text-slate-500">No suggestions available yet.</p>
          </div>
        )}
        
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-white/10 hover:bg-white/5 hover:text-cyan-400 hover:border-cyan-500/30 transition-all group/btn"
          onClick={() => onAskAI(config.question)}
        >
          <Sparkles className="h-3 w-3 mr-2 opacity-70" />
          Ask AI for more details
          <ChevronRight className="h-3 w-3 ml-auto opacity-50 group-hover/btn:opacity-100 group-hover/btn:translate-x-0.5 transition-all" />
        </Button>
      </CardContent>
    </Card>
  );
}

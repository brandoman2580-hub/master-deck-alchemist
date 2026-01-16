/**
 * Phase 3: UI Block Renderer for Strict Schema Recommendations
 * Renders UI blocks from the new RecommenderResponse format
 */

"use client";

import { useMemo, useState } from "react";
import { UIBlock, SuggestionContent, Reasoning } from "../../types/recommender";
import { Card } from "../../types/card";
import { useDeck } from "@/context/deck-context";
import { Button } from "./button";
import { Card as CardUI, CardContent } from "./card";
import { Badge } from "./badge";
import { 
  Check, 
  AlertCircle, 
  AlertTriangle,
  Info, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb,
  Sparkles, 
  TrendingUp,
  Target,
  Zap,
  Star,
  Brain,
  Plus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CardPreview } from "./card-preview";
import { motion, AnimatePresence } from "framer-motion";
import {
  InteractiveRecommendationCard,
} from "@/components/ui/interactive-recommendation-card";

export interface RecommenderUIBlocksProps {
  blocks: UIBlock[];
  recommendations?: Array<{
    cardId: string;
    cardName?: string;
    action: string;
    reason: string;
    impactEst: number;
    synergyScore?: number;
    banned?: boolean;
    priority?: "must-have" | "highly-recommended" | "good-option" | "situational"; // Phase 2: Priority field
  }>;
  reasoning?: Reasoning; // Phase 2: Reasoning output
  allCards?: Card[];
  onApplySuggestion?: (suggestionId: string, cardId?: string) => void;
  onPreviewSuggestion?: (suggestionId: string, cardId?: string) => void;
  onAddCard?: (cardId: string) => void; // New: Direct add card handler
  onRemoveCard?: (cardId: string) => void; // New: Direct remove card handler
  addedCardIds?: Set<string>; // Track which cards have been added
  addingCardIds?: Set<string>; // Track which cards are currently being added
  deckCards?: {
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
  };
  onAskFollowUp?: (prompt: string) => void;
}

export function RecommenderUIBlocks({
  blocks,
  recommendations = [],
  reasoning,
  allCards = [],
  onApplySuggestion,
  onPreviewSuggestion,
  onAddCard,
  onRemoveCard,
  addedCardIds = new Set(),
  addingCardIds = new Set(),
  deckCards,
  onAskFollowUp,
}: RecommenderUIBlocksProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);
  const { currentDeck } = useDeck();

  const deckCardsForUi =
    deckCards ||
    (currentDeck
      ? {
          mainDeck: currentDeck.mainDeck,
          extraDeck: currentDeck.extraDeck,
          sideDeck: currentDeck.sideDeck,
        }
      : undefined);

  const reasoningWeaknesses = useMemo(() => {
    const raw = (reasoning?.deckWeaknesses || "").trim();
    if (!raw) return [];

    return raw
      .split(";")
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [reasoning?.deckWeaknesses]);

  const reasoningStrategy = useMemo(() => {
    const raw = (reasoning?.strategicConsiderations || "").trim();
    if (!raw) return [];

    return raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
  }, [reasoning?.strategicConsiderations]);

  // Create a map of recommendations by cardId for quick lookup
  const recMap = new Map(
    recommendations.map((r) => [r.cardId, r])
  );

  // Phase 2: Group recommendations by priority (use priority field if available, fallback to impactEst)
  const priorityGroups = {
    "must-have": recommendations.filter(r => 
      r.priority === "must-have" || (!r.priority && r.impactEst >= 0.8)
    ),
    "highly-recommended": recommendations.filter(r => 
      r.priority === "highly-recommended" || (!r.priority && r.impactEst >= 0.6 && r.impactEst < 0.8)
    ),
    "good-option": recommendations.filter(r => 
      r.priority === "good-option" || (!r.priority && r.impactEst >= 0.5 && r.impactEst < 0.6)
    ),
    "situational": recommendations.filter(r => 
      r.priority === "situational" || (!r.priority && r.impactEst < 0.5)
    ),
  };

  // Get priority badge styling
  const getPriorityBadge = (impactEst: number) => {
    if (impactEst >= 0.8) {
      return { label: "Must-Have", className: "bg-red-500/20 text-red-400 border-red-500/50", icon: Target };
    } else if (impactEst >= 0.6) {
      return { label: "Highly Recommended", className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50", icon: Star };
    } else if (impactEst >= 0.5) {
      return { label: "Good Option", className: "bg-blue-500/20 text-blue-400 border-blue-500/50", icon: TrendingUp };
    } else {
      return { label: "Situational", className: "bg-slate-500/20 text-slate-400 border-slate-500/50", icon: Info };
    }
  };

  // Create a map of cards by ID and name
  const cardMap = new Map<number, Card>();
  const cardNameMap = new Map<string, Card>();
  allCards.forEach((card) => {
    cardMap.set(card.id, card);
    cardNameMap.set(card.name.toLowerCase(), card);
  });

  const renderBlock = (block: UIBlock, index: number) => {
    switch (block.type) {
      case "text":
        return (
          <div
            key={block.id || index}
            className="prose prose-invert max-w-none text-slate-200 leading-relaxed"
          >
            {typeof block.content === "string" ? (
              <ReactMarkdown
                components={{
                  strong: ({ children }) => (
                    <strong className="text-cyan-400 font-semibold">
                      {children}
                    </strong>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0">{children}</p>
                  ),
                }}
              >
                {block.content}
              </ReactMarkdown>
            ) : (
              <p>{String(block.content)}</p>
            )}
          </div>
        );

      case "list":
        const listItems =
          typeof block.content === "string"
            ? [block.content]
            : Array.isArray(block.content)
              ? block.content
              : [];
        return (
          <ul
            key={block.id || index}
            className="list-disc list-inside space-y-2 text-slate-200 ml-4"
          >
            {listItems.map((item, i) => (
              <li key={i} className="leading-relaxed">
                {typeof item === "string" ? (
                  <ReactMarkdown
                    components={{
                      strong: ({ children }) => (
                        <strong className="text-cyan-400">{children}</strong>
                      ),
                    }}
                  >
                    {item}
                  </ReactMarkdown>
                ) : (
                  String(item)
                )}
              </li>
            ))}
          </ul>
        );

      case "card":
        // Render card preview if content is a card ID or name
        const cardIdentifier =
          typeof block.content === "string" ? block.content : "";
        const cardId = parseInt(cardIdentifier, 10);
        const card =
          !isNaN(cardId)
            ? cardMap.get(cardId)
            : cardNameMap.get(cardIdentifier.toLowerCase());

        if (card) {
          return (
            <div key={block.id || index} className="my-4">
              <CardPreview card={card}>
                <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer">
                  {card.name}
                </span>
              </CardPreview>
            </div>
          );
        }
        return null;

      case "table":
        // Render table if content is an object or array
        if (typeof block.content === "object" && !Array.isArray(block.content)) {
          const tableData = block.content as Record<string, any>;
          return (
            <div
              key={block.id || index}
              className="overflow-x-auto my-4 border border-cyan-500/30 rounded-lg"
            >
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(tableData).map(([key, value], i) => (
                    <tr
                      key={i}
                      className="border-b border-cyan-500/20 last:border-0"
                    >
                      <td className="px-4 py-2 font-semibold text-cyan-400 bg-slate-900/50">
                        {key}
                      </td>
                      <td className="px-4 py-2 text-slate-200">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;

      case "suggestion":
        // Render actionable suggestion
        const suggestionContent = block.content as unknown as SuggestionContent;
        if (
          typeof suggestionContent === "object" &&
          suggestionContent.suggestionId
        ) {
          const rec = suggestionContent.cardId
            ? recMap.get(suggestionContent.cardId)
            : null;
          const card = suggestionContent.cardId
            ? cardMap.get(parseInt(suggestionContent.cardId, 10))
            : null;

          return (
            <CardUI
              key={block.id || index}
              className="my-4 border-cyan-500/30 bg-slate-900/50"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-slate-200 mb-2">
                      {suggestionContent.label}
                    </p>
                    {rec && (
                      <div className="space-y-1 text-sm text-slate-400">
                        <p>{rec.reason}</p>
                        {rec.banned && (
                          <p className="text-red-400 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            This card is banned in the selected format
                          </p>
                        )}
                        {rec.synergyScore !== undefined && rec.synergyScore > 0.3 && (
                          <div className="flex items-center gap-2 text-xs">
                            <Sparkles className="h-3 w-3 text-cyan-400" />
                            <span className="text-slate-300">
                              Synergy:{" "}
                              <span className={`font-semibold ${
                                rec.synergyScore >= 0.8 ? "text-green-400" : rec.synergyScore >= 0.6 ? "text-cyan-400" : "text-yellow-400"
                              }`}>
                                {Math.round(rec.synergyScore * 100)}%
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {suggestionContent.verb === "apply" && onApplySuggestion && (
                      <Button
                        size="sm"
                        onClick={() => {
                          console.log("🔵 Apply button clicked:", {
                            suggestionId: suggestionContent.suggestionId,
                            cardId: suggestionContent.cardId,
                            hasCallback: !!onApplySuggestion,
                          });
                          onApplySuggestion(
                            suggestionContent.suggestionId,
                            suggestionContent.cardId
                          );
                        }}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Apply
                      </Button>
                    )}
                    {suggestionContent.verb === "preview" &&
                      onPreviewSuggestion && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onPreviewSuggestion(
                              suggestionContent.suggestionId,
                              suggestionContent.cardId
                            )
                          }
                        >
                          <Info className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                      )}
                  </div>
                </div>
                {card && (
                  <div className="mt-3 pt-3 border-t border-cyan-500/20">
                    <CardPreview card={card}>
                      <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer">
                        {card.name}
                      </span>
                    </CardPreview>
                  </div>
                )}
              </CardContent>
            </CardUI>
          );
        }
        return null;

      default:
        return (
          <div
            key={block.id || index}
            className="text-slate-400 text-sm italic"
          >
            Unknown block type: {block.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Phase 3: Reasoning Tree */}
      {reasoning ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-cyan-500/20 rounded-xl bg-gradient-to-br from-slate-900/50 to-slate-800/30 backdrop-blur-sm overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-cyan-500/5 transition-colors"
            aria-expanded={isReasoningExpanded}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Brain className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
                  Reasoning Tree
                  <Badge
                    variant="outline"
                    className="text-xs border-cyan-500/50 text-cyan-400"
                  >
                    Phase 3
                  </Badge>
                </h3>
                <p className="text-sm text-slate-400 mt-0.5">{reasoning.userIntent}</p>
              </div>
            </div>
            {isReasoningExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          <AnimatePresence>
            {isReasoningExpanded ? (
              <motion.div
                key="reasoning-tree"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden"
              >
                <motion.div
                  className="px-6 py-4 border-t border-cyan-500/10"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.06 } },
                  }}
                >
                  <div className="relative pl-8 space-y-5">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />

                    <ReasoningNode
                      icon={Target}
                      label="Your Goal"
                      accentClassName="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                    >
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {reasoning.userIntent}
                      </p>
                    </ReasoningNode>

                    <ReasoningNode
                      icon={AlertTriangle}
                      label="Deck Weaknesses"
                      accentClassName="text-red-300 bg-red-500/10 border-red-500/20"
                    >
                      {reasoningWeaknesses.length > 0 ? (
                        <ul className="space-y-1.5 text-sm text-slate-300">
                          {reasoningWeaknesses.map((w) => (
                            <li key={w} className="flex items-start gap-2">
                              <span className="mt-1 text-red-300">•</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No specific weaknesses detected.
                        </p>
                      )}
                    </ReasoningNode>

                    <ReasoningNode
                      icon={Lightbulb}
                      label="Strategy"
                      accentClassName="text-cyan-300 bg-white/5 border-white/10"
                    >
                      {reasoningStrategy.length > 0 ? (
                        <ul className="space-y-1.5 text-sm text-slate-300">
                          {reasoningStrategy.map((s) => (
                            <li key={s} className="flex items-start gap-2">
                              <span className="mt-1 text-cyan-300">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {reasoning.candidateEvaluation ? (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-cyan-300" />
                            <div className="text-xs font-semibold text-slate-200">
                              Candidate evaluation
                            </div>
                          </div>
                          <p className="text-slate-300 text-sm leading-relaxed">
                            {reasoning.candidateEvaluation}
                          </p>
                        </div>
                      ) : null}

                      {reasoning.metaContext ? (
                        <details className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-200">
                            Meta context
                          </summary>
                          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                            {reasoning.metaContext}
                          </p>
                        </details>
                      ) : null}
                    </ReasoningNode>

                    <ReasoningNode
                      icon={Check}
                      label="Recommendations"
                      accentClassName="text-green-300 bg-green-500/10 border-green-500/20"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <Badge className="bg-red-500/15 text-red-300 border border-red-500/20">
                          Must-have: {priorityGroups["must-have"].length}
                        </Badge>
                        <Badge className="bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                          Highly recommended: {priorityGroups["highly-recommended"].length}
                        </Badge>
                        <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/20">
                          Good options: {priorityGroups["good-option"].length}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        See below for priority-grouped cards and visual impact panels.
                      </p>
                    </ReasoningNode>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}

      {/* Phase 2: Priority-Grouped Recommendations */}
      {recommendations.length > 0 && (
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
                {onAddCard && priorityGroups["must-have"].some(r => r.action === "add" && !r.banned) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      priorityGroups["must-have"]
                        .filter(r => r.action === "add" && !r.banned && !addedCardIds.has(r.cardId))
                        .forEach(r => onAddCard(r.cardId));
                    }}
                    className="border-cyan-500/50 hover:bg-cyan-500/10 text-cyan-400"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add All ({priorityGroups["must-have"].filter(r => r.action === "add" && !r.banned && !addedCardIds.has(r.cardId)).length})
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                {priorityGroups["must-have"].map((rec, index) => {
                  const card = rec.cardId ? cardMap.get(parseInt(rec.cardId, 10)) : null;
                  const priorityBadge = getPriorityBadge(rec.impactEst);
                  
                  if (!card) return null;

                  return (
                    <motion.div
                      key={rec.cardId || index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                        <InteractiveRecommendationCard
                        recommendation={{
                          ...rec,
                          evidence: (rec as any).evidence || [],
                        }}
                        card={card}
                        onAdd={onAddCard}
                        deckCards={deckCardsForUi}
                        onExplainSynergy={
                          onAskFollowUp
                            ? () =>
                                onAskFollowUp(
                                  `Explain why ${card.name} synergizes with my deck. Be specific and reference concrete interactions.`,
                                )
                            : undefined
                        }
                        onPreview={(cardId) => {
                          const previewCard = cardMap.get(parseInt(cardId, 10));
                          if (previewCard && onPreviewSuggestion) {
                            onPreviewSuggestion(rec.cardId, cardId);
                          }
                        }}
                        isAdding={addingCardIds.has(rec.cardId)}
                        wasAdded={addedCardIds.has(rec.cardId)}
                        priorityBadge={priorityBadge}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Other Priority Groups */}
          {[
            { key: "highly-recommended" as const, label: "Highly Recommended", icon: Star },
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
                    const card = rec.cardId ? cardMap.get(parseInt(rec.cardId, 10)) : null;
                    const priorityBadge = getPriorityBadge(rec.impactEst);
                    
                    if (!card) return null;

                    return (
                      <motion.div
                        key={rec.cardId || index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <InteractiveRecommendationCard
                          recommendation={{
                            ...rec,
                            evidence: (rec as any).evidence || [],
                          }}
                          card={card}
                          onAdd={onAddCard}
                          onRemove={onRemoveCard}
                          deckCards={deckCardsForUi}
                          onExplainSynergy={
                            onAskFollowUp
                              ? () =>
                                  onAskFollowUp(
                                    `Explain why ${card.name} synergizes with my deck. Be specific and reference concrete interactions.`,
                                  )
                              : undefined
                          }
                          onPreview={(cardId) => {
                            const previewCard = cardMap.get(parseInt(cardId, 10));
                            if (previewCard && onPreviewSuggestion) {
                              onPreviewSuggestion(rec.cardId, cardId);
                            }
                          }}
                          isAdding={addingCardIds.has(rec.cardId)}
                          wasAdded={addedCardIds.has(rec.cardId)}
                          priorityBadge={priorityBadge}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Render standard UI blocks */}
      <div className="space-y-4">
        {blocks.map((block, index) => renderBlock(block, index))}
      </div>
    </div>
  );
}

function ReasoningNode({
  icon: Icon,
  label,
  accentClassName,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accentClassName: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      className="relative"
    >
      <div
        className={`absolute left-[-29px] top-1 w-8 h-8 rounded-full border flex items-center justify-center ${accentClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </motion.div>
  );
}

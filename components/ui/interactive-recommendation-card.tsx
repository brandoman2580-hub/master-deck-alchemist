"use client";

import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  GitCompare,
  MessageCircleQuestion,
  XCircle,
} from "lucide-react";
import type { Card } from "@/types/card";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { DeckDiffViewer } from "@/components/deck/deck-diff-viewer";
import { useAIPrefsStore } from "@/store/aiPrefsStore";
import { useAIFeedbackStore } from "@/store/aiFeedbackStore";
import { submitTelemetryFeedback } from "@/lib/api/recommendationFeedback";
import { Badge } from "./badge";
import { Button } from "./button";
import { ConfidenceIndicator, type ConfidenceReason } from "./confidence-indicator";
import { EnhancedRecommendationCard } from "./enhanced-recommendation-card";

export type InteractiveRecommendationCardProps = ComponentProps<
  typeof EnhancedRecommendationCard
> & {
  deckCards?: {
    mainDeck: Card[];
    extraDeck: Card[];
    sideDeck: Card[];
  };
  onExplainSynergy?: () => void;
  onReject?: (reason: RejectReason) => void;
};

export type RejectReason =
  | "no-synergy"
  | "prefer-other"
  | "too-expensive"
  | "too-complex"
  | "already-have";

type ActivePanel = "impact" | "diff" | null;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function scoreFromKeywords(descLower: string, keywords: string[]): number {
  return keywords.reduce((acc, kw) => acc + (descLower.includes(kw) ? 1 : 0), 0);
}

function getSuggestedDeckSection(args: {
  card: Card;
  action: string;
}): "mainDeck" | "extraDeck" | "sideDeck" {
  const { card, action } = args;

  if (action === "tech") return "sideDeck";

  const type = (card.type || "").toLowerCase();
  if (
    type.includes("fusion") ||
    type.includes("synchro") ||
    type.includes("xyz") ||
    type.includes("link")
  ) {
    return "extraDeck";
  }
  return "mainDeck";
}

function getRejectReasonLabel(reason: RejectReason): string {
  switch (reason) {
    case "no-synergy":
      return "Doesn't fit / no synergy";
    case "prefer-other":
      return "Prefer other options";
    case "too-expensive":
      return "Too expensive";
    case "too-complex":
      return "Too complex to pilot";
    case "already-have":
      return "I already run it";
  }
}

function getRejectReasonHint(reason: RejectReason): string {
  switch (reason) {
    case "no-synergy":
      return "Ask for options that match your archetype/gameplan";
    case "prefer-other":
      return "Ask for different lines or archetypes";
    case "too-expensive":
      return "Ask for more accessible alternatives that serve the same role";
    case "too-complex":
      return "Ask for simpler lines or lower-complexity options";
    case "already-have":
      return "Ask how to best integrate it (or what to cut)";
  }
}

function buildRejectFollowUpPrompt(args: {
  cardName: string;
  reasons: RejectReason[];
  note?: string;
}): string {
  const { cardName, reasons, note } = args;

  const primary =
    reasons.includes("no-synergy")
      ? "no-synergy"
      : reasons.includes("too-complex")
        ? "too-complex"
        : reasons.includes("too-expensive")
          ? "too-expensive"
          : reasons.includes("already-have")
            ? "already-have"
            : reasons.includes("prefer-other")
              ? "prefer-other"
              : reasons[0];

  const noteLine = note?.trim()
    ? `\n\nExtra context from me: ${note.trim()}`
    : "";

  switch (primary) {
    case "no-synergy":
      return `I don't think ${cardName} fits my deck's gameplan. Suggest alternatives that synergize better with my current deck/archetype, and explain the synergy.${noteLine}`;
    case "too-complex":
      return `I think ${cardName} is too complex to pilot. Suggest simpler, lower-complexity alternatives that achieve a similar goal, and explain tradeoffs.${noteLine}`;
    case "too-expensive":
      return `I want alternatives to ${cardName} that are more accessible to obtain (lower rarity / easier to get) but serve the same role. Keep the list short and explain the tradeoffs.${noteLine}`;
    case "already-have":
      return `I already run ${cardName}. Tell me how to best integrate it: what should I cut, and what package/ratios make sense in my current list?${noteLine}`;
    case "prefer-other":
      return `I want different options than ${cardName}. Suggest alternative lines/cards (or a slightly different package) that achieve a similar goal, and explain tradeoffs.${noteLine}`;
  }
}

/**
 * Phase 2 scaffold: interactive recommendation card.
 * Today this wraps the existing EnhancedRecommendationCard (impact bar, evidence, add/remove actions).
 */
export function InteractiveRecommendationCard({
  deckCards,
  onExplainSynergy,
  onReject,
  ...baseProps
}: InteractiveRecommendationCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const explainTo = useAIPrefsStore((s) => s.explainTo);
  const playstyle = useAIPrefsStore((s) => s.playstyle);
  const recordFeedback = useAIFeedbackStore((s) => s.recordFeedback);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [submittedReject, setSubmittedReject] = useState<{
    reasons: RejectReason[];
    note?: string;
  } | null>(null);
  const [rejectReasons, setRejectReasons] = useState<RejectReason[]>([]);
  const [rejectNote, setRejectNote] = useState("");
  const [didCopyFollowUp, setDidCopyFollowUp] = useState(false);
  const [isRejectPanelOpen, setIsRejectPanelOpen] = useState(false);

  const { recommendation, card } = baseProps;

  const impactSignals = useMemo(() => {
    const descLower = (card.desc || "").toLowerCase();

    const keywordConsistency = scoreFromKeywords(descLower, [
      "draw",
      "search",
      "add",
      "excavate",
      "deck",
    ]);
    const keywordPower = scoreFromKeywords(descLower, [
      "special summon",
      "fusion summon",
      "synchro summon",
      "xyz summon",
      "link summon",
      "attack",
      "damage",
      "combo",
    ]);
    const keywordInteraction = scoreFromKeywords(descLower, [
      "negate",
      "destroy",
      "banish",
      "cannot",
      "discard",
    ]);

    const base = clamp01(recommendation.impactEst);
    const synergy = clamp01(recommendation.synergyScore ?? 0);

    const consistency = clamp01(base * 0.55 + synergy * 0.15 + keywordConsistency * 0.08);
    const power = clamp01(base * 0.55 + synergy * 0.15 + keywordPower * 0.08);
    const interaction = clamp01(base * 0.45 + synergy * 0.2 + keywordInteraction * 0.08);
    const brickRisk = clamp01(0.65 - consistency * 0.55);

    return {
      consistency,
      power,
      interaction,
      brickRisk,
    };
  }, [card.desc, recommendation.impactEst, recommendation.synergyScore]);

  const deckDiff = useMemo(() => {
    if (!deckCards) return null;

    const deckSection = getSuggestedDeckSection({
      card,
      action: recommendation.action,
    });

    const before = deckCards[deckSection];
    const canApplyInDiff = recommendation.action === "add" || recommendation.action === "tech";
    const after = canApplyInDiff
      ? (before.some((c) => c.id === card.id) ? before : [...before, card])
      : before;

    return {
      before,
      after,
      deckSection,
    };
  }, [card, deckCards, recommendation.action]);

  const synergyLinks = useMemo(() => {
    if (!deckCards) return [];

    const combinedText = [
      recommendation.reason || "",
      ...((recommendation as any).evidence || []),
    ]
      .join(" ")
      .toLowerCase();

    const deckAll = [
      ...deckCards.mainDeck,
      ...deckCards.extraDeck,
      ...deckCards.sideDeck,
    ];

    const byName = deckAll
      .filter((c) => c.id !== card.id)
      .filter((c) => combinedText.includes(c.name.toLowerCase()))
      .slice(0, 6);
    if (byName.length > 0) return byName;

    const archetype = (card.archetype || "").toLowerCase().trim();
    if (!archetype) return deckAll.slice(0, 6);

    return deckAll
      .filter((c) => (c.archetype || "").toLowerCase().trim() === archetype)
      .slice(0, 6);
  }, [card.archetype, card.id, deckCards, recommendation]);

  const confidence = useMemo(() => {
    const impact = clamp01(recommendation.impactEst);
    const synergy = clamp01(recommendation.synergyScore ?? impact);
    return clamp01((impact + synergy) / 2);
  }, [recommendation.impactEst, recommendation.synergyScore]);

  const confidenceReasons = useMemo<ConfidenceReason[]>(() => {
    const reasons: ConfidenceReason[] = [];

    if (recommendation.banned) {
      reasons.push({ tone: "negative", text: "Banned/illegal in the selected format." });
    }

    const synergy = recommendation.synergyScore;
    if (synergy !== undefined) {
      const pct = Math.round(clamp01(synergy) * 100);
      reasons.push({
        tone: synergy >= 0.7 ? "positive" : synergy >= 0.45 ? "warning" : "warning",
        text: `Synergy score: ${pct}%`,
      });
    }

    const evidenceCount = Array.isArray((recommendation as any).evidence)
      ? ((recommendation as any).evidence as unknown[]).length
      : 0;
    reasons.push({
      tone: evidenceCount >= 2 ? "positive" : "warning",
      text: `Evidence signals: ${evidenceCount}`,
    });

    reasons.push({
      tone:
        recommendation.priority === "must-have"
          ? "positive"
          : recommendation.priority === "situational"
            ? "warning"
            : "positive",
      text: `Priority: ${recommendation.priority || "auto"}`,
    });

    return reasons;
  }, [recommendation]);

  const handleTogglePanel = (panel: Exclude<ActivePanel, null>) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const toggleRejectReason = (reason: RejectReason) => {
    setDidCopyFollowUp(false);
    setRejectReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  const submitRejectFeedback = () => {
    if (rejectReasons.length === 0) return;

    const note = rejectNote.trim() ? rejectNote.trim() : undefined;
    setSubmittedReject({ reasons: rejectReasons, note });
    setIsRejectPanelOpen(false);

    // Record structured feedback for future turns (Phase 5).
    recordFeedback({
      cardId: recommendation.cardId,
      accepted: false,
      reasons: rejectReasons,
      note,
    });

    // Back-compat: report the primary reason to the parent callback if provided.
    const primary = rejectReasons[0];
    if (primary) onReject?.(primary);

    // Telemetry: best-effort. Uses a fingerprint compatible with the edge function
    // when deckCards are available (matches deckZ shape: main/extra/side with cardId/count).
    if (deckCards) {
      const deckForTelemetry = {
        main: deckCards.mainDeck.map((c) => ({ cardId: c.id, count: 1 })),
        extra: deckCards.extraDeck.map((c) => ({ cardId: c.id, count: 1 })),
        side: deckCards.sideDeck.map((c) => ({ cardId: c.id, count: 1 })),
      };

      void submitTelemetryFeedback({
        deckFingerprint: "", // generated from deck + prefs if not provided
        suggestionId: `reject-${recommendation.action}-${recommendation.cardId}`,
        accepted: false,
        cardId: recommendation.cardId,
        rejectionReasons: rejectReasons,
        feedbackText: note,
        deck: deckForTelemetry,
        explainTo,
        userPrefs: playstyle ? { playstyle } : {},
      } as Parameters<typeof submitTelemetryFeedback>[0]).catch((error) => {
        console.warn("Failed to submit rejection telemetry:", error);
      });
    }
  };

  const copyFollowUpPrompt = async () => {
    if (rejectReasons.length === 0) return;
    const note = rejectNote.trim() ? rejectNote.trim() : undefined;
    const prompt = buildRejectFollowUpPrompt({
      cardName: card.name,
      reasons: rejectReasons,
      note,
    });

    try {
      await navigator.clipboard.writeText(prompt);
      setDidCopyFollowUp(true);
    } catch (error) {
      console.warn("Failed to copy follow-up prompt:", error);
      setDidCopyFollowUp(false);
    }
  };

  return (
    <div className={`space-y-2 ${submittedReject ? "opacity-80" : ""}`}>
      <EnhancedRecommendationCard {...baseProps} />

      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceIndicator
          score={confidence}
          label="Confidence"
          reasons={confidenceReasons}
          className="mr-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-200"
          onClick={() => handleTogglePanel("impact")}
          aria-pressed={activePanel === "impact"}
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Impact & Synergy
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
          onClick={() => handleTogglePanel("diff")}
          aria-pressed={activePanel === "diff"}
          disabled={!deckDiff}
          title={!deckDiff ? "Select a deck to enable diff preview" : undefined}
        >
          <GitCompare className="h-4 w-4 mr-2" />
          Deck Diff
        </Button>

        {onExplainSynergy ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
            onClick={onExplainSynergy}
          >
            <MessageCircleQuestion className="h-4 w-4 mr-2" />
            Explain
          </Button>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-200"
          onClick={() => setIsRejectPanelOpen((v) => !v)}
          aria-expanded={isRejectPanelOpen}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reject
        </Button>

        {submittedReject ? (
          <Badge className="bg-red-500/15 text-red-300 border border-red-500/30">
            Rejected
            {submittedReject.reasons.length === 1
              ? `: ${getRejectReasonLabel(submittedReject.reasons[0])}`
              : ` (${submittedReject.reasons.length})`}
          </Badge>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {isRejectPanelOpen ? (
          <motion.div
            key="reject-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="text-xs text-slate-300 font-semibold">
                Why reject this suggestion?
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  ["no-synergy", "prefer-other", "too-expensive", "too-complex", "already-have"] as const
                ).map((reason) => (
                  <Button
                    key={reason}
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 ${
                      rejectReasons.includes(reason) ? "ring-1 ring-cyan-500/40" : ""
                    }`}
                    onClick={() => toggleRejectReason(reason)}
                    title={getRejectReasonHint(reason)}
                  >
                    {getRejectReasonLabel(reason)}
                  </Button>
                ))}
              </div>

              <div className="mt-3">
                <label className="block text-[11px] font-medium text-slate-300">
                  Optional note (what would you prefer instead?)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => {
                    setDidCopyFollowUp(false);
                    setRejectNote(e.target.value);
                  }}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30"
                  placeholder="Example: I need more low-commitment interaction going second…"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-100"
                  onClick={submitRejectFeedback}
                  disabled={rejectReasons.length === 0}
                >
                  Save feedback
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-slate-200"
                  onClick={() => void copyFollowUpPrompt()}
                  disabled={rejectReasons.length === 0}
                >
                  {didCopyFollowUp ? "Copied follow-up" : "Copy follow-up prompt"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {activePanel ? (
          <motion.div
            key={`panel-${activePanel}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              {activePanel === "diff" && deckDiff ? (
                <DeckDiffViewer
                  before={deckDiff.before}
                  after={deckDiff.after}
                  beforeLabel={`Current (${deckDiff.deckSection})`}
                  afterLabel={`With ${card.name}`}
                />
              ) : null}

              {activePanel === "impact" ? (
                <motion.div
                  initial={
                    prefersReducedMotion ? { opacity: 1 } : { opacity: 0, rotateY: 12 }
                  }
                  animate={
                    prefersReducedMotion ? { opacity: 1 } : { opacity: 1, rotateY: 0 }
                  }
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  style={{ transformPerspective: 900 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Visual Proof (estimated)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Derived from recommendation scoring + card text signals
                      </div>
                    </div>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                      Impact: {Math.round(recommendation.impactEst * 100)}%
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      {[
                        {
                          label: "Consistency",
                          value: impactSignals.consistency,
                          color: "from-cyan-500 to-cyan-300",
                        },
                        {
                          label: "Power ceiling",
                          value: impactSignals.power,
                          color: "from-purple-500 to-purple-300",
                        },
                        {
                          label: "Interaction",
                          value: impactSignals.interaction,
                          color: "from-blue-500 to-blue-300",
                        },
                        {
                          label: "Brick risk (lower is better)",
                          value: impactSignals.brickRisk,
                          color: "from-red-500 to-red-300",
                          invert: true,
                        },
                      ].map((m) => {
                        const percentage = Math.round(
                          (m.invert ? 1 - m.value : m.value) * 100,
                        );
                        return (
                          <div key={m.label} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{m.label}</span>
                              <span className="text-slate-200 font-medium">
                                {percentage}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                              <motion.div
                                initial={prefersReducedMotion ? { width: `${percentage}%` } : { width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                                className={`h-full bg-gradient-to-r ${m.color}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs font-semibold text-slate-200">
                        Synergy links
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        Cards in your deck mentioned/related to this recommendation
                      </div>

                      <div className="mt-3">
                        {synergyLinks.length > 0 ? (
                          <SynergyGraph
                            recommendedCard={card}
                            linkedCards={synergyLinks}
                            prefersReducedMotion={prefersReducedMotion}
                          />
                        ) : (
                          <div className="text-xs text-slate-400">
                            No obvious links detected yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SynergyGraph({
  recommendedCard,
  linkedCards,
  prefersReducedMotion,
}: {
  recommendedCard: Card;
  linkedCards: Card[];
  prefersReducedMotion: boolean;
}) {
  const width = 520;
  const height = Math.max(140, linkedCards.length * 28 + 28);
  const leftX = 40;
  const rightX = width - 40;
  const topY = 24;
  const gapY = 26;

  const leftY = height / 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Synergy graph for ${recommendedCard.name}`}
        className="min-w-[520px]"
      >
        {/* Left node */}
        <circle cx={leftX} cy={leftY} r={10} className="fill-cyan-400/80" />
        <text
          x={leftX + 16}
          y={leftY + 4}
          className="fill-slate-200"
          fontSize="11"
        >
          {recommendedCard.name.slice(0, 20)}
          {recommendedCard.name.length > 20 ? "…" : ""}
        </text>

        {linkedCards.map((c, i) => {
          const y = topY + i * gapY + 8;
          const pathD = `M ${leftX} ${leftY} C ${leftX + 120} ${leftY}, ${rightX - 120} ${y}, ${rightX} ${y}`;

          return (
            <g key={c.deckInstanceId || c.id}>
              <motion.path
                d={pathD}
                fill="none"
                stroke="rgba(34,211,238,0.45)"
                strokeWidth={2}
                initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.55, ease: "easeOut", delay: i * 0.04 }}
              />
              <circle cx={rightX} cy={y} r={7} className="fill-white/15" />
              <text
                x={rightX - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-300"
                fontSize="11"
              >
                {c.name.slice(0, 26)}
                {c.name.length > 26 ? "…" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

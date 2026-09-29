"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, AlertTriangle, Lightbulb, Brain, Check, Target, Zap } from "lucide-react";
import { Badge } from "../badge";
import { ReasoningNode } from "./reasoning-node";
import type { Reasoning } from "@/types/recommender";
import type { Recommendation } from "./priority-helpers";

interface ReasoningTreeProps {
  reasoning?: Reasoning;
  priorityGroups: {
    "must-have": Recommendation[];
    "highly-recommended": Recommendation[];
    "good-option": Recommendation[];
    "situational": Recommendation[];
  };
}

export function ReasoningTree({ reasoning, priorityGroups }: ReasoningTreeProps) {
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false);

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

  if (!reasoning) return null;

  return (
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
            <h3 className="text-lg font-semibold text-slate-50">
              Reasoning Tree
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
  );
}

"use client";

import { useMemo, useState } from "react";
import { Sparkles, Swords, Shield, Cpu, Zap, GraduationCap } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { AIExplainToPreference, AIPlaystylePreference } from "@/store/aiPrefsStore";

type Step = "playstyle" | "explainTo";

const PLAYSTYLES: Array<{
  id: AIPlaystylePreference;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClassName: string;
}> = [
  {
    id: "combo",
    label: "Combo",
    description: "Maximize lines, starters/extenders, and ceiling.",
    icon: Cpu,
    accentClassName: "border-purple-500/30 bg-purple-500/10 text-purple-200",
  },
  {
    id: "control",
    label: "Control",
    description: "Prioritize interaction, disruption, and grind.",
    icon: Shield,
    accentClassName: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  },
  {
    id: "aggro",
    label: "Aggro",
    description: "Pressure fast: OTK lines, tempo, damage output.",
    icon: Zap,
    accentClassName: "border-red-500/30 bg-red-500/10 text-red-200",
  },
  {
    id: "stall",
    label: "Stall",
    description: "Slow the game: floodgates, attrition, locks.",
    icon: Shield,
    accentClassName: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    description: "Balanced: flexible lines, adaptable interaction.",
    icon: Swords,
    accentClassName: "border-slate-500/30 bg-white/5 text-slate-200",
  },
];

const EXPLAIN_LEVELS: Array<{
  id: AIExplainToPreference;
  label: string;
  description: string;
  badgeClassName: string;
}> = [
  {
    id: "novice",
    label: "Quick & clear",
    description: "Simple rationale and straightforward action steps.",
    badgeClassName: "bg-white/5 text-slate-200 border-white/10",
  },
  {
    id: "intermediate",
    label: "Detailed",
    description: "Key interactions + small combo lines when helpful.",
    badgeClassName: "bg-cyan-500/10 text-cyan-100 border-cyan-500/20",
  },
  {
    id: "advanced",
    label: "Tournament-level",
    description: "Edge-case lines, sequencing, and matchup framing.",
    badgeClassName: "bg-purple-500/10 text-purple-200 border-purple-500/20",
  },
];

export interface AIPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playstyle: AIPlaystylePreference | null;
  explainTo: AIExplainToPreference;
  onChangePlaystyle: (playstyle: AIPlaystylePreference) => void;
  onChangeExplainTo: (explainTo: AIExplainToPreference) => void;
  onSkip?: () => void;
  onDone?: () => void;
  mode?: "onboarding" | "edit";
}

export function AIPreferencesDialog({
  open,
  onOpenChange,
  playstyle,
  explainTo,
  onChangePlaystyle,
  onChangeExplainTo,
  onSkip,
  onDone,
  mode = "onboarding",
}: AIPreferencesDialogProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("playstyle");

  const selectedPlaystyle = useMemo(() => {
    return playstyle ? PLAYSTYLES.find((p) => p.id === playstyle) : null;
  }, [playstyle]);

  const canContinue = step === "playstyle" ? !!playstyle : true;

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setStep("playstyle");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white/10 border border-white/20 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            Personalize your AI
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {mode === "onboarding"
              ? "Pick a playstyle and how detailed you want explanations. (Budget settings are disabled for now.)"
              : "Tune the AI to your preferred playstyle and detail level."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border-cyan-500/30 text-cyan-200",
                step === "playstyle" ? "bg-cyan-500/10" : "bg-white/5",
              )}
            >
              1. Playstyle
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "border-cyan-500/30 text-cyan-200",
                step === "explainTo" ? "bg-cyan-500/10" : "bg-white/5",
              )}
            >
              2. Detail level
            </Badge>
          </div>

          {step === "playstyle" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PLAYSTYLES.map((p) => {
                const Icon = p.icon;
                const isSelected = p.id === playstyle;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChangePlaystyle(p.id)}
                    className={cn(
                      "text-left rounded-xl border px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
                      isSelected
                        ? "border-cyan-400/50 bg-cyan-500/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg border", p.accentClassName)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-white">
                            {p.label}
                          </div>
                          {isSelected ? (
                            <Badge className="bg-cyan-500/15 text-cyan-200 border border-cyan-500/20">
                              Selected
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">
                          {p.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-cyan-300" />
                      Explanation level
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      Controls how deep the AI goes on lines, sequencing, and edge cases.
                    </div>
                  </div>
                  {selectedPlaystyle ? (
                    <Badge className="bg-white/5 text-slate-200 border border-white/10">
                      Playstyle: {selectedPlaystyle.label}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {EXPLAIN_LEVELS.map((l) => {
                    const isSelected = l.id === explainTo;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => onChangeExplainTo(l.id)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
                          isSelected
                            ? "border-cyan-400/50 bg-cyan-500/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                        )}
                        aria-pressed={isSelected}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">
                              {l.label}
                            </div>
                            <div className="mt-1 text-xs text-slate-300">
                              {l.description}
                            </div>
                          </div>
                          <Badge className={cn("border", l.badgeClassName)}>
                            {l.id}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          {step === "explainTo" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("playstyle")}
              disabled={!prefersReducedMotion ? false : false}
              className="border-white/20"
            >
              Back
            </Button>
          ) : null}

          {mode === "onboarding" && step === "playstyle" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onSkip?.();
                onOpenChange(false);
              }}
              className="text-slate-300 hover:text-white"
            >
              Skip for now
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={() => {
              if (step === "playstyle") {
                if (canContinue) setStep("explainTo");
                return;
              }
              onDone?.();
              onOpenChange(false);
            }}
            disabled={!canContinue}
            className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-100"
          >
            {step === "playstyle" ? "Continue" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


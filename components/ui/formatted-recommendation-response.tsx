"use client";

import React from "react";
import { Card } from "../../types/card.ts";
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RecommendedCard {
  id?: number;
  name: string;
  reason?: string;
  synergy_score?: number;
  risk_assessment?: "low" | "medium" | "high";
}

interface AlternativeConsideration {
  name: string;
  why_not?: string;
}

interface RecommendationMeta {
  intent_classified?: string;
  confidence?: number;
  format_specific_notes?: string;
}

interface FormattedRecommendationResponseProps {
  answer: string;
  recommendedCards?: RecommendedCard[];
  alternativeConsiderations?: AlternativeConsideration[];
  meta?: RecommendationMeta;
  validatedCards?: Card[];
  allCards?: Card[];
}

export function FormattedRecommendationResponse({
  answer,
  recommendedCards = [],
  alternativeConsiderations = [],
  meta,
  validatedCards = [],
  allCards = [],
}: FormattedRecommendationResponseProps) {
  // Create a map of validated cards for quick lookup
  const validatedCardMap = new Map<number, Card>();
  validatedCards.forEach(card => {
    validatedCardMap.set(card.id, card);
  });

  // Create a map of all cards for name matching
  const allCardsMap = new Map<string, Card>();
  allCards.forEach(card => {
    allCardsMap.set(card.name.toLowerCase(), card);
  });

  // Get risk assessment color
  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case "low":
        return "text-green-400 bg-green-400/10 border-green-400/30";
      case "medium":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
      case "high":
        return "text-red-400 bg-red-400/10 border-red-400/30";
      default:
        return "text-slate-400 bg-slate-400/10 border-slate-400/30";
    }
  };

  // Get synergy score color
  const getSynergyColor = (score?: number) => {
    if (!score) return "text-slate-400";
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-orange-400";
  };

  // Render markdown with card name highlighting
  const renderMarkdown = (content: string) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong({ children }) {
            const text = String(children).trim();
            const normalizedText = text.toLowerCase();
            
            // Check if this matches a validated card
            const matchedCard = Array.from(validatedCardMap.values()).find(
              c => c.name.toLowerCase() === normalizedText
            ) || Array.from(allCardsMap.values()).find(
              c => c.name.toLowerCase() === normalizedText
            );
            
            if (matchedCard) {
              return (
                <strong className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors">
                  {text}
                </strong>
              );
            }
            
            return <strong className="text-slate-200 font-semibold">{children}</strong>;
          },
          p({ children }) {
            return <p className="text-slate-300 leading-relaxed mb-3">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside space-y-2 text-slate-300 ml-4 mb-3">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside space-y-2 text-slate-300 ml-4 mb-3">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main Answer */}
      <div className="prose prose-invert max-w-none">
        <div className="text-slate-200 leading-relaxed">
          {renderMarkdown(answer)}
        </div>
      </div>

      {/* Recommended Cards Section */}
      {recommendedCards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-slate-50">
              Recommended Cards
            </h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {recommendedCards.map((card, index) => {
              const validatedCard = card.id ? validatedCardMap.get(card.id) : null;
              const cardName = validatedCard?.name || card.name;
              
              return (
                <div
                  key={index}
                  className="group relative rounded-lg border border-cyan-500/20 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                          {cardName}
                        </h4>
                        {card.risk_assessment && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(card.risk_assessment)}`}
                          >
                            {card.risk_assessment}
                          </span>
                        )}
                      </div>
                      
                      {card.reason && (
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {card.reason}
                        </p>
                      )}
                      
                      {card.synergy_score !== undefined && (
                        <div className="flex items-center gap-2 pt-1">
                          <TrendingUp className="h-4 w-4 text-cyan-400" />
                          <span className={`text-sm font-medium ${getSynergyColor(card.synergy_score)}`}>
                            Synergy: {card.synergy_score}/100
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alternative Considerations Section */}
      {alternativeConsiderations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-slate-50">
              Alternative Considerations
            </h3>
          </div>
          
          <div className="space-y-3">
            {alternativeConsiderations.map((alt, index) => (
              <div
                key={index}
                className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold text-yellow-300">
                      {alt.name}
                    </h4>
                    {alt.why_not && (
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {alt.why_not}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta Information */}
      {meta && (meta.confidence !== undefined || meta.format_specific_notes) && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 backdrop-blur-sm">
          <div className="space-y-2">
            {meta.confidence !== undefined && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm text-slate-300">
                  Confidence: <span className="font-semibold text-green-400">{meta.confidence}%</span>
                </span>
              </div>
            )}
            {meta.format_specific_notes && (
              <p className="text-sm text-slate-400 italic">
                {meta.format_specific_notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


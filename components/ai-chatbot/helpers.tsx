import Image from "next/image";
import { Aperture, Loader2, Check, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { CardPreview } from "../ui/card-preview";
import type { Card } from "../../types/card";
import type { BanStatus, DeckSection } from "../../types/types";
import type {
  DeckAnalysisStructured,
  DeckStats,
  CategoryRecommendationResponseType,
} from "./types";
import { getCategoryRecommendations } from "../../lib/api/recommendationAgent";
import type { CategoryRecommendationRequestLocal } from "./types";

// ============================================================================
// API HELPERS
// ============================================================================

export async function fetchCategoryRecommendations(
  payload: CategoryRecommendationRequestLocal,
): Promise<CategoryRecommendationResponseType> {
  const result = await getCategoryRecommendations({
    deckId: payload.deckId,
    category: payload.category,
    prompt: payload.prompt,
  });
  
  // Map the response to match our local type
  return {
    category: result.category as CategoryRecommendationResponseType["category"],
    mode: result.mode,
    recommendations: result.recommendations,
    sessionId: result.sessionId,
    error: result.error,
  };
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Render a dimension block (used in deck analysis card)
 */
export function renderDimensionBlock(
  title: string,
  explanation: string,
  suggestions: string[],
) {
  return (
    <section className="space-y-1">
      <h4 className="text-sm font-semibold text-slate-50">{title}</h4>
      <p className="text-sm text-slate-300">{explanation}</p>
      {suggestions && suggestions.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs text-slate-400">
          {suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Render a compact power level card
 */
export function renderPowerLevelCard(analysis: {
  power_level?: { score: number; explanation: string; suggestions: string[] };
}): JSX.Element | null {
  const power = analysis?.power_level;
  if (!power) return null;

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
        Power Level Analysis
      </h3>
      <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
        <span className="font-medium text-white/80">Power Level</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
          {power.score}/10
        </span>
      </div>
      <p className="text-sm text-white/80">{power.explanation}</p>
      {power.suggestions && power.suggestions.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase text-white/70">
            Suggestions
          </h4>
          <ul className="list-disc pl-5 text-xs text-white/70">
            {power.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Render card suggestions with "Add to Deck" actions
 */
export function renderCardSuggestionsCard(
  analysis: {
    suggested_cards?: {
      card_name: string;
      section: "main" | "side" | "extra";
      reason: string;
    }[];
    notes?: string;
  },
  allCards: Card[],
  addCardToDeck: (card: Card, deckType: DeckSection) => void,
  getOptimalDeckType: (card: Card) => DeckSection,
  getDeckStats: () => {
    mainCount: number;
    extraCount: number;
    sideCount: number;
  },
  banlist: Record<string, BanStatus>,
  deckId?: string | number,
): JSX.Element | null {
  const suggestions = analysis?.suggested_cards ?? [];
  const deckStats = getDeckStats();

  const handleAddCard = (
    cardName: string,
    section: "main" | "side" | "extra",
  ) => {
    if (!deckId) return;

    // Find the card by name
    const card = allCards.find(
      (c) => c.name.toLowerCase() === cardName.toLowerCase(),
    );

    if (!card) {
      console.warn(`Card not found: ${cardName}`);
      return;
    }

    // Map section to DeckSection
    const deckTypeMap: Record<"main" | "side" | "extra", DeckSection> = {
      main: "mainDeck",
      side: "sideDeck",
      extra: "extraDeck",
    };

    const deckType = deckTypeMap[section] || getOptimalDeckType(card);
    addCardToDeck(card, deckType);
  };

  const isDeckSectionFull = (section: "main" | "side" | "extra"): boolean => {
    switch (section) {
      case "main":
        return deckStats.mainCount >= 60;
      case "extra":
        return deckStats.extraCount >= 15;
      case "side":
        return deckStats.sideCount >= 15;
      default:
        return false;
    }
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
        Card Suggestions
      </h3>
      {analysis?.notes && (
        <p className="text-xs text-slate-300">{analysis.notes}</p>
      )}
      <div className="space-y-2">
        {suggestions.length === 0 && (
          <p className="text-xs text-slate-400">
            No specific card suggestions were generated.
          </p>
        )}
        {suggestions.map((s, i) => {
          // Find the card to get its image
          const card = allCards.find(
            (c) => c.name.toLowerCase() === s.card_name.toLowerCase(),
          );
          const cardImage = card?.card_images?.[0]?.image_url_small;
          const isFull = isDeckSectionFull(s.section);
          const banStatus = card
            ? banlist[card.name] || "Unlimited"
            : "Unlimited";

          return (
            <div
              key={`${s.card_name}-${i}`}
              className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-xs"
            >
              {/* Card Image with Preview */}
              {card && cardImage ? (
                <CardPreview card={card} banStatus={banStatus}>
                  <div className="flex-shrink-0 cursor-pointer">
                    <Image
                      width={60}
                      height={88}
                      src={cardImage}
                      alt={s.card_name}
                      className="w-12 h-auto object-contain rounded-md"
                    />
                  </div>
                </CardPreview>
              ) : cardImage ? (
                <div className="flex-shrink-0">
                  <Image
                    width={60}
                    height={88}
                    src={cardImage}
                    alt={s.card_name}
                    className="w-12 h-auto object-contain rounded-md"
                  />
                </div>
              ) : null}
              {/* Card Info */}
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-50 truncate">
                    {s.card_name}
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/80 flex-shrink-0">
                    {s.section} deck
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">
                  {s.reason}
                </p>
                {deckId && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      disabled={isFull}
                      className={`text-[11px] rounded-full border px-2 py-0.5 transition-colors ${
                        isFull
                          ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                          : "border-white/20 bg-white/10 hover:bg-white/10 hover:text-white text-white/80"
                      }`}
                      onClick={() => handleAddCard(s.card_name, s.section)}
                      title={
                        isFull
                          ? `${s.section} deck is full`
                          : `Add to ${s.section} deck`
                      }
                    >
                      {isFull ? "Deck full" : "Add to deck"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Render category recommendation card
 */
export function renderCategoryRecommendationCard(
  response: CategoryRecommendationResponseType,
  allCards: Card[],
  banlist: Record<string, BanStatus>,
  canAddCardToDeck: (card: Card, deckType: DeckSection) => boolean,
  getOptimalDeckType: (card: Card) => DeckSection,
  handleAddCardToDeck: (card: Card, selectedDeckType?: DeckSection) => void,
  addingCardId: string | null,
  addedCards: Set<string>,
): JSX.Element {
  const category = response.category;
  const analysis = response.recommendations?.categoryAnalysis;
  const recs =
    response.recommendations?.recommendations?.filter((rec) =>
      allCards.some((c) => c.name.toLowerCase() === rec.cardName.toLowerCase()),
    ) || [];
  const cuts = response.recommendations?.cutsRecommendations || [];
  const ratios = response.recommendations?.ratioAdjustments || [];

  return (
    <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-white/80">
            <Aperture className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-white/70">
              {category} mode
            </div>
            <div className="text-lg font-semibold text-white leading-tight">
              {analysis?.summary || "Targeted evaluation of your deck."}
            </div>
            <div className="text-sm text-white/80">
              {analysis?.formatSpecificNotes ||
                `Mode: ${response.mode}. Recommendations tuned for this format.`}
            </div>
          </div>
        </div>
        {typeof analysis?.score === "number" && (
          <div className="px-3 py-1 text-sm font-semibold text-white">
            Score {analysis.score}/10
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {analysis?.specificIssues?.length ? (
          <div className="rounded-2xl bg-gradient-to-br from-red-500/10 via-slate-900/30 to-slate-900/40 p-4">
            <div className="text-xs font-semibold uppercase text-red-200/80 mb-1">
              Issues to fix
            </div>
            <ul className="space-y-1.5 text-sm text-slate-200">
              {analysis.specificIssues.map((item, idx) => (
                <li key={`issue-${idx}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {analysis?.opportunities?.length ? (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900/30 to-slate-900/40 p-4">
            <div className="text-xs font-semibold uppercase text-emerald-200/80 mb-1">
              Opportunities
            </div>
            <ul className="space-y-1.5 text-sm text-slate-200">
              {analysis.opportunities.map((item, idx) => (
                <li key={`opportunity-${idx}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {recs.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/90 tracking-wide">
              Recommended inserts
            </p>
            <span className="text-xs text-slate-400">
              Add directly from the list
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 items-stretch">
            {recs.map((rec, idx) => {
              const card = allCards.find(
                (c) => c.name.toLowerCase() === rec.cardName.toLowerCase(),
              );
              const banStatus = card ? banlist[card.name] || "Unlimited" : "Unlimited";
              const optimalDeckType = card ? getOptimalDeckType(card) : "mainDeck";
              const canAdd = card ? canAddCardToDeck(card, optimalDeckType) : false;
              const isAdding = card && addingCardId === card.id.toString();
              const wasAdded = card && addedCards.has(card.id.toString());

              return (
                <div
                  key={`${rec.cardName}-${idx}`}
                  className="rounded-2xl bg-gradient-to-br from-slate-900/70 via-slate-900/55 to-slate-900/35 p-5 ring-1 ring-slate-800 transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-50">
                          {rec.cardName}
                        </span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] uppercase text-slate-200">
                          {rec.location} slot
                        </span>
                        {rec.priority && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] uppercase text-emerald-200">
                            {rec.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {rec.reason}
                      </p>
                      {rec.synergies?.length ? (
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-white/80">
                          {rec.synergies.map((s) => (
                            <span
                              key={`${rec.cardName}-${s}`}
                              className="rounded-full bg-white/10 border border-white/20 px-2 py-0.5"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {rec.impact && (
                        <div className="text-xs text-emerald-200">
                          Impact: {rec.impact}
                        </div>
                      )}
                    </div>
                    {card ? (
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-[10px] uppercase text-slate-400">
                          {banStatus}
                        </div>
                        <Button
                          variant={wasAdded ? "default" : "ghost"}
                          size="sm"
                          className="h-8 px-3 text-xs rounded-full bg-slate-800 text-slate-50 hover:bg-slate-700"
                          disabled={!canAdd || isAdding}
                          onClick={() => handleAddCardToDeck(card, optimalDeckType)}
                        >
                          {isAdding ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Adding
                            </>
                          ) : wasAdded ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Added
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(cuts.length > 0 || ratios.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {cuts.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-rose-500/10 via-slate-900/40 to-slate-900/20 p-4 space-y-2">
              <p className="text-sm font-semibold text-rose-100">Consider cutting</p>
              <div className="space-y-2 text-sm text-slate-100">
                {cuts.map((cut, idx) => (
                  <div key={`${cut.cardName}-${idx}`} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] uppercase text-rose-100">
                        -{cut.quantity || 1}
                      </span>
                      <span className="font-semibold">{cut.cardName}</span>
                    </div>
                    {cut.reason && (
                      <p className="text-xs text-slate-200/80">{cut.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {ratios.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-slate-900/20 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-100">
                Ratio adjustments
              </p>
              <div className="space-y-2 text-sm text-slate-100">
                {ratios.map((ratio, idx) => (
                  <div key={`${ratio.cardName}-${idx}`} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] uppercase text-emerald-100">
                        {ratio.currentQuantity} ➜ {ratio.recommendedQuantity}
                      </span>
                      <span className="font-semibold">{ratio.cardName}</span>
                    </div>
                    {ratio.reason && (
                      <p className="text-xs text-slate-200/80">{ratio.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Render a rich deck analysis card
 */
export function renderDeckAnalysisCard(
  analysis: DeckAnalysisStructured,
  deckStats?: DeckStats | null,
): JSX.Element {
  const dims = analysis;

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl p-4 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-white/90">
          Deck Analysis Summary
        </h3>
        <p className="text-sm leading-relaxed text-white/90">{dims.overview}</p>
      </div>

      {/* Basic deck stats, if available */}
      {deckStats && (
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-white/70">Main Deck</div>
            <div className="text-white font-semibold">
              {deckStats.mainCount} cards
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-white/70">Extra Deck</div>
            <div className="text-white font-semibold">
              {deckStats.extraCount} cards
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-white/70">Side Deck</div>
            <div className="text-white font-semibold">
              {deckStats.sideCount} cards
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-white/70">Monsters</div>
            <div className="text-white font-semibold">
              {deckStats.monsterCount}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-white/70">Spells</div>
            <div className="text-white font-semibold">
              {deckStats.spellCount}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="font-medium text-white/70">Traps</div>
            <div className="text-white font-semibold">
              {deckStats.trapCount}
            </div>
          </div>
        </div>
      )}

      {/* Score chips row */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          ["Power", dims.power_level.score],
          ["Consistency", dims.consistency.score],
          ["Resilience", dims.resilience_and_grind.score],
          ["Matchups", dims.matchup_profile.score],
          ["Complexity", dims.complexity_and_skill.score],
        ].map(([label, score]) => (
          <div
            key={label as string}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1"
          >
            <span className="font-medium text-white/80">{label}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
              {score}/10
            </span>
          </div>
        ))}
      </div>

      {/* Strategic identity */}
      <section className="space-y-1">
        <h4 className="text-sm font-semibold text-white">
          Strategic Identity:{" "}
          <span className="text-white/90">
            {dims.strategic_identity.playstyle}
          </span>
        </h4>
        <p className="text-sm text-white/80">
          {dims.strategic_identity.description}
        </p>
      </section>

      {/* Detailed sections in a vertical stack */}
      <div className="space-y-3 text-sm">
        {renderDimensionBlock(
          "Power Level",
          dims.power_level.explanation,
          dims.power_level.suggestions,
        )}
        {renderDimensionBlock(
          "Consistency",
          dims.consistency.explanation,
          dims.consistency.suggestions,
        )}
        {renderDimensionBlock(
          "Resilience & Grind",
          dims.resilience_and_grind.explanation,
          dims.resilience_and_grind.suggestions,
        )}
        {renderDimensionBlock(
          "Matchup Profile",
          dims.matchup_profile.explanation,
          dims.matchup_profile.suggestions,
        )}
        <section className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-50">
            Complexity & Skill
          </h4>
          <p className="text-sm text-slate-300">
            {dims.complexity_and_skill.explanation}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-white/70">
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
              Skill floor: {dims.complexity_and_skill.skill_floor}
            </span>
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5">
              Skill ceiling: {dims.complexity_and_skill.skill_ceiling}
            </span>
          </div>
        </section>
      </div>

      {/* Banlist notes */}
      {dims.illegal_cards && (
        <section className="space-y-1 border-t border-white/10 pt-3">
          <h4 className="text-sm font-semibold text-white">Banlist Notes</h4>
          <p className="text-xs text-white/80">
            {dims.illegal_cards.forbidden.length === 0
              ? "No banned cards were found in the deck."
              : dims.illegal_cards.notes}
          </p>
          {dims.illegal_cards.forbidden.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-red-300">
              {dims.illegal_cards.forbidden.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}


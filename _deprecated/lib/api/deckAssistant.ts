/**
 * @deprecated Prefer `@/lib/api/strategist`. Kept as a thin re-export during cutover.
 * The `deck-assistant` edge function twin is NOT LIVE — see
 * `supabase/functions/deck-assistant/NOT_LIVE.md`.
 */
export {
  sendChatMessage,
  recommendationsFromCoach,
  tuningChipsFromCoach,
  getConversationHistory,
  updateConversationName,
  getConversationMessages,
  type DeckAssistantChatRequest,
  type DeckAssistantChatResponse,
  type DeckAssistantRecommendation,
  type RatioSuggestion,
  type AssistantMode,
  type DeckCoachResponse,
} from "./strategist";

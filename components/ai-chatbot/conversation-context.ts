import type { ConversationContext } from "../../lib/api/recommendationAgent";
import type { Message } from "./types";
import { useAIFeedbackStore } from "@/store/aiFeedbackStore";

const MAX_CONVERSATION_PREVIOUS_RECOMMENDATIONS = 18;
const MAX_CONVERSATION_FEEDBACK_ITEMS = 24;
const MAX_CONVERSATION_DECK_SNAPSHOTS = 10;
const MAX_CONVERSATION_GOALS = 8;

export function extractUserGoalsFromText(text: string): string[] {
  const normalized = text.toLowerCase();
  const goals = new Set<string>();

  if (
    normalized.includes("budget") ||
    normalized.includes("cheap") ||
    normalized.includes("afford")
  ) {
    goals.add("budget");
  }
  if (
    normalized.includes("competitive") ||
    normalized.includes("meta") ||
    normalized.includes("tournament")
  ) {
    goals.add("competitive");
  }
  if (normalized.includes("casual") || normalized.includes("fun")) {
    goals.add("casual");
  }
  if (normalized.includes("otk")) goals.add("otk");
  if (normalized.includes("control")) goals.add("control");
  if (normalized.includes("combo")) goals.add("combo");

  return Array.from(goals);
}

export function buildConversationContextFromMessages(args: {
  messages: Message[];
  feedbackStates: ReadonlyMap<string, "approved" | "disapproved" | null>;
  deckStats?: { mainCount: number; extraCount: number; sideCount: number } | null;
  pendingUserMessage?: string;
}): ConversationContext {
  const { messages, feedbackStates, deckStats, pendingUserMessage } = args;

  const previousRecommendations: string[] = [];
  const userFeedback: ConversationContext["userFeedback"] = [];
  const deckEvolution: ConversationContext["deckEvolution"] = [];
  const goalSet = new Set<string>();

  messages.forEach((m) => {
    if (m.role === "user") {
      extractUserGoalsFromText(m.content).forEach((g) => goalSet.add(g));
      return;
    }

    const recs = m.recommenderResponse?.recommendations ?? [];
    if (recs.length === 0) return;

    // Track prior recommendations as short "id:name" tokens for continuity
    recs.forEach((r) => {
      const token = `${r.cardId}:${r.cardName || ""}`.trim();
      if (token.length > 0) previousRecommendations.push(token);
    });

    // Expand message-level feedback into per-card feedback (best-effort)
    const fb = feedbackStates.get(m.id);
    if (fb === "approved" || fb === "disapproved") {
      recs.forEach((r) => {
        userFeedback.push({ cardId: r.cardId, accepted: fb === "approved" });
      });
    }

    const deckFingerprint = m.recommenderResponse?.meta?.deckFingerprint;
    if (typeof deckFingerprint === "string" && deckFingerprint.length > 0) {
      deckEvolution.push({
        timestamp: m.timestamp.toISOString(),
        deckFingerprint,
      });
    }
  });

  if (pendingUserMessage) {
    extractUserGoalsFromText(pendingUserMessage).forEach((g) => goalSet.add(g));
  }

  if (deckStats) {
    deckEvolution.push({
      timestamp: new Date().toISOString(),
      mainCount: deckStats.mainCount,
      extraCount: deckStats.extraCount,
      sideCount: deckStats.sideCount,
    });
  }

  const storeFeedback = useAIFeedbackStore.getState().events.map((e) => {
    const reasons = (e.reasons || []).join(",");
    const note = e.note?.trim() ? ` | ${e.note.trim()}` : "";
    const reason = reasons ? `${reasons}${note}` : e.note?.trim() || undefined;

    return {
      cardId: e.cardId,
      accepted: e.accepted,
      ...(reason ? { reason } : {}),
    };
  });

  // Merge in explicit per-card feedback (Phase 5) and keep latest per cardId.
  const mergedFeedback = [...userFeedback, ...storeFeedback];
  const latestByCardId = new Map<string, ConversationContext["userFeedback"][number]>();
  mergedFeedback.forEach((item) => {
    if (latestByCardId.has(item.cardId)) latestByCardId.delete(item.cardId);
    latestByCardId.set(item.cardId, item);
  });

  return {
    previousRecommendations: previousRecommendations.slice(
      -MAX_CONVERSATION_PREVIOUS_RECOMMENDATIONS,
    ),
    userFeedback: Array.from(latestByCardId.values()).slice(
      -MAX_CONVERSATION_FEEDBACK_ITEMS,
    ),
    deckEvolution: deckEvolution.slice(-MAX_CONVERSATION_DECK_SNAPSHOTS),
    userGoals: Array.from(goalSet).slice(0, MAX_CONVERSATION_GOALS),
  };
}

// Client API for recommendation feedback
// Type-safe feedback submission with error handling
// Supports both legacy format and new telemetry schema

import { getAccessToken } from "../supabaseClient";
import { fingerprintDeck } from "../recommender-helpers";

// Legacy feedback format (backward compatible)
export interface FeedbackRequest {
  recommendation_id: string;
  feedback_type: "approved" | "disapproved";
  feedback_text?: string;
}

// New telemetry format
export interface TelemetryFeedbackRequest {
  deckFingerprint: string;
  suggestionId: string;
  accepted: boolean;
  timestamp?: string; // ISO string, defaults to now
  userId?: string; // Optional, will use auth user if not provided
  // Rich feedback fields
  cardId?: string; // Recommended card id (string to match recommender schema)
  rejectionReasons?: string[]; // Reason codes (e.g., ["no-synergy","too-complex"])
  feedbackText?: string; // Optional free-text note from the user
  // Enhanced context for better feedback
  context?: {
    originalQuestion?: string;
    requestedCount?: number | { exact?: number; min?: number; max?: number };
    receivedCount?: number;
    hasDuplicates?: boolean;
    duplicateCount?: number;
  };
}

// Extended type for submitTelemetryFeedback that includes optional deck data
export type TelemetryFeedbackRequestWithDeck = TelemetryFeedbackRequest & {
  deck?: unknown;
  explainTo?: string;
  userPrefs?: unknown;
};

export interface FeedbackResponse {
  success: boolean;
  feedback_id?: string; // Legacy format
  telemetry_id?: string; // New format
  message: string;
}

/**
 * Submit feedback for a recommendation (legacy format)
 */
export async function submitFeedback(
  request: FeedbackRequest,
): Promise<FeedbackResponse> {
  return submitFeedbackInternal(request);
}

/**
 * Submit telemetry feedback (new format)
 * Automatically generates deck fingerprint if not provided
 */
export async function submitTelemetryFeedback(
  request: TelemetryFeedbackRequestWithDeck,
): Promise<FeedbackResponse> {
  // Generate fingerprint if not provided but deck data is available
  let deckFingerprint = request.deckFingerprint;
  if ((!deckFingerprint || deckFingerprint === "") && request.deck !== undefined) {
    try {
      deckFingerprint = await fingerprintDeck(
        request.deck,
        request.explainTo || "novice",
        request.userPrefs || {},
      );
    } catch (error) {
      throw new Error(`Failed to generate deck fingerprint: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (!deckFingerprint || deckFingerprint === "") {
    throw new Error("deckFingerprint is required. Provide either deckFingerprint or deck data.");
  }

  const telemetryRequest: TelemetryFeedbackRequest = {
    deckFingerprint,
    suggestionId: request.suggestionId,
    accepted: request.accepted,
    timestamp: request.timestamp || new Date().toISOString(),
    userId: request.userId,
    ...(request.cardId && { cardId: request.cardId }),
    ...(request.rejectionReasons && request.rejectionReasons.length > 0
      ? { rejectionReasons: request.rejectionReasons }
      : {}),
    ...(request.feedbackText && request.feedbackText.trim()
      ? { feedbackText: request.feedbackText.trim() }
      : {}),
    ...(request.context && { context: request.context }),
  };

  return submitFeedbackInternal(telemetryRequest);
}

/**
 * Internal function to submit feedback (handles both formats)
 */
async function submitFeedbackInternal(
  request: FeedbackRequest | TelemetryFeedbackRequest,
): Promise<FeedbackResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error(
      "Authentication required. Please log in to submit feedback.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = `${supabaseUrl}/functions/v1/recommendation-feedback`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any = {};
    try {
      errorData = errorText ? JSON.parse(errorText) : {};
    } catch {
      errorData = {
        error: errorText || "Unknown error",
        status: response.status,
      };
    }

    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    throw new Error(
      errorData.error ||
        errorData.message ||
        `Failed to submit feedback (${response.status})`,
    );
  }

  return (await response.json()) as FeedbackResponse;
}

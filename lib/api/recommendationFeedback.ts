// Client API for recommendation feedback (Phase 4)
// Rationale: Type-safe feedback submission with error handling
// Supports both legacy format and new telemetry schema

import { getAccessToken } from "../supabaseClient";
import { fingerprintDeck } from "../recommender-helpers";

// Legacy feedback format (backward compatible)
export interface FeedbackRequest {
  recommendation_id: string;
  feedback_type: "approved" | "disapproved";
  feedback_text?: string;
}

// Phase 4: New telemetry format
export interface TelemetryFeedbackRequest {
  deckFingerprint: string;
  suggestionId: string;
  accepted: boolean;
  timestamp?: string; // ISO string, defaults to now
  userId?: string; // Optional, will use auth user if not provided
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
 * Submit telemetry feedback (Phase 4: new format)
 * Automatically generates deck fingerprint if not provided
 */
export async function submitTelemetryFeedback(
  request: TelemetryFeedbackRequestWithDeck,
): Promise<FeedbackResponse> {
  console.log("📤 submitTelemetryFeedback called with:", {
    hasDeckFingerprint: !!request.deckFingerprint,
    deckFingerprintLength: request.deckFingerprint?.length || 0,
    suggestionId: request.suggestionId,
    accepted: request.accepted,
    hasDeck: !!request.deck,
  });

  // Generate fingerprint if not provided but deck data is available
  let deckFingerprint = request.deckFingerprint;
  if ((!deckFingerprint || deckFingerprint === "") && request.deck !== undefined) {
    console.log("🔑 Generating deck fingerprint from deck data...");
    try {
      deckFingerprint = await fingerprintDeck(
        request.deck,
        request.explainTo || "novice",
        request.userPrefs || {},
      );
      console.log("✅ Generated fingerprint:", deckFingerprint.substring(0, 16) + "...");
    } catch (error) {
      console.error("❌ Failed to generate fingerprint:", error);
      throw new Error(`Failed to generate deck fingerprint: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (!deckFingerprint || deckFingerprint === "") {
    console.error("❌ No deckFingerprint available and no deck data to generate from");
    throw new Error("deckFingerprint is required. Provide either deckFingerprint or deck data.");
  }

  const telemetryRequest: TelemetryFeedbackRequest = {
    deckFingerprint,
    suggestionId: request.suggestionId,
    accepted: request.accepted,
    timestamp: request.timestamp || new Date().toISOString(),
    userId: request.userId,
    ...(request.context && { context: request.context }),
  };

  console.log("📤 Sending telemetry request to Edge Function...");
  return submitFeedbackInternal(telemetryRequest);
}

/**
 * Internal function to submit feedback (handles both formats)
 */
async function submitFeedbackInternal(
  request: FeedbackRequest | TelemetryFeedbackRequest,
): Promise<FeedbackResponse> {
  console.log("📡 submitFeedbackInternal called");
  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error("❌ No access token available");
    throw new Error(
      "Authentication required. Please log in to submit feedback.",
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL");
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }

  const url = `${supabaseUrl}/functions/v1/recommendation-feedback`;
  console.log("📡 Sending request to:", url);
  console.log("📡 Request payload:", JSON.stringify(request, null, 2));
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  console.log("📡 Response status:", response.status, response.statusText);

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

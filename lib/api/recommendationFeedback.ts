// Client API for recommendation feedback
// Rationale: Type-safe feedback submission with error handling

import { getAccessToken } from "../supabaseClient";

export interface FeedbackRequest {
  recommendation_id: string;
  feedback_type: "approved" | "disapproved";
  feedback_text?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedback_id: string;
  message: string;
}

/**
 * Submit feedback for a recommendation
 */
export async function submitFeedback(
  request: FeedbackRequest,
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

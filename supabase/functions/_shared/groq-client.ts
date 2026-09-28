/**
 * Shared Groq chat.completions caller with org/project permission fallbacks.
 */

import {
  groqReasoningEffortForModel,
  isGroqModelPermissionError,
  resolveGroqModelCandidates,
} from "./groq-model.ts";

export interface GroqChatJsonArgs {
  apiKey: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** Prefer this model first; otherwise use resolveGroqModelCandidates(). */
  modelName?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GroqChatJsonResult {
  content: string;
  modelUsed: string;
}

/**
 * Call Groq JSON chat; on model_permission 403, try the next candidate.
 */
export async function callGroqChatJson(
  args: GroqChatJsonArgs,
): Promise<GroqChatJsonResult> {
  const {
    apiKey,
    messages,
    temperature = 0.4,
    topP = 0.9,
    maxTokens = 2200,
    signal,
  } = args;

  const candidates = args.modelName?.trim()
    ? [
      args.modelName.trim(),
      ...resolveGroqModelCandidates().filter((m) => m !== args.modelName?.trim()),
    ]
    : resolveGroqModelCandidates();

  let lastError = "No Groq model candidates available";

  for (const model of candidates) {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    };
    const effort = groqReasoningEffortForModel(model);
    if (effort) body.reasoning_effort = effort;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify(body),
      },
    );

    if (response.ok) {
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "{}";
      if (model !== candidates[0]) {
        console.warn(
          `Groq preferred model unavailable; using fallback model=${model}`,
        );
      }
      return { content, modelUsed: model };
    }

    const errorText = await response.text();
    lastError = `Groq API error: ${response.status} - ${errorText}`;

    if (isGroqModelPermissionError(response.status, errorText)) {
      console.warn(
        `Groq model blocked (${model}); trying next candidate. body=${errorText.slice(0, 300)}`,
      );
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
}

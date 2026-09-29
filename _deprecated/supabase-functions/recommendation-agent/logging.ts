/**
 * Phase 2: Comprehensive Logging
 * Structured logging for monitoring and debugging
 */

const DEBUG_MODE = Deno.env.get("DEBUG_MODE") === "true";

export interface LogContext {
  recommendationId?: string;
  userId?: string;
  question?: string;
  intent?: string;
  playstyle?: string;
  [key: string]: any;
}

/**
 * Structured log entry
 */
export function log(
  level: "info" | "warn" | "error" | "debug",
  message: string,
  context?: LogContext,
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    level,
    timestamp,
    message,
    ...context,
  };

  const logString = JSON.stringify(logEntry);
  
  switch (level) {
    case "error":
      console.error(logString);
      break;
    case "warn":
      console.warn(logString);
      break;
    case "debug":
      if (DEBUG_MODE) {
        console.log(logString);
      }
      break;
    default:
      console.log(logString);
  }
}

/**
 * Log stage start
 */
export function logStageStart(
  stage: string,
  context?: LogContext,
): number {
  const startTime = Date.now();
  log("info", `[${stage}] Starting`, { ...context, stage, startTime });
  return startTime;
}

/**
 * Log stage completion
 */
export function logStageEnd(
  stage: string,
  startTime: number,
  context?: LogContext,
): void {
  const duration = Date.now() - startTime;
  log("info", `[${stage}] Completed`, { ...context, stage, duration, durationMs: duration });
}

/**
 * Log retrieval metrics
 */
export function logRetrieval(
  query: string,
  candidateCount: number,
  context?: LogContext,
): void {
  log("info", "[RETRIEVAL] Candidate retrieval complete", {
    ...context,
    query: query.substring(0, 100),
    candidateCount,
  });
}

/**
 * Log scoring metrics
 */
export function logScoring(
  candidateCount: number,
  topScores: Array<{ name: string; score: number }>,
  context?: LogContext,
): void {
  log("info", "[SCORING] Scoring complete", {
    ...context,
    candidateCount,
    topScores: topScores.slice(0, 5),
  });
}

/**
 * Log reasoning output summary
 */
export function logReasoning(
  reasoning: {
    userIntent: string;
    deckWeaknesses: string[];
    strategicConsiderations: string[];
  },
  context?: LogContext,
): void {
  log("info", "[REASONING] Reasoning generated", {
    ...context,
    userIntent: reasoning.userIntent.substring(0, 100),
    weaknessesCount: reasoning.deckWeaknesses.length,
    considerationsCount: reasoning.strategicConsiderations.length,
  });
}

/**
 * Log final recommendations
 */
export function logRecommendations(
  count: number,
  priorities: Record<string, number>,
  context?: LogContext,
): void {
  log("info", "[RECOMMENDATION] Recommendations generated", {
    ...context,
    recommendationCount: count,
    priorityDistribution: priorities,
  });
}

/**
 * Log error with context
 */
export function logError(
  error: Error | unknown,
  stage: string,
  context?: LogContext,
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  log("error", `[${stage}] Error occurred`, {
    ...context,
    stage,
    error: errorMessage,
    stack: errorStack,
  });
}

/**
 * Log cache hit/miss
 */
export function logCache(
  type: "hit" | "miss",
  key: string,
  context?: LogContext,
): void {
  log("debug", `[CACHE] ${type.toUpperCase()}`, {
    ...context,
    cacheType: type,
    key: key.substring(0, 50),
  });
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  duration: number,
  metrics?: Record<string, number>,
  context?: LogContext,
): void {
  log("info", `[PERFORMANCE] ${operation}`, {
    ...context,
    operation,
    duration,
    durationMs: duration,
    ...metrics,
  });
}

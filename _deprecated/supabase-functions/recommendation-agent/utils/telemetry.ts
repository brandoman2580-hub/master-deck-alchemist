/**
 * Structured telemetry for pipeline step tracking
 * Provides visibility into each stage of the recommendation pipeline
 */

export interface PipelineStep {
  step: string;
  duration_ms: number;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

// Store pipeline steps for this request
const pipelineSteps: PipelineStep[] = [];

/**
 * Log a pipeline step with timing information
 */
export function logPipelineStep(
  step: string,
  data: any,
  startTime: number,
): void {
  const duration = Date.now() - startTime;
  const success = !data.error;

  const stepData: PipelineStep = {
    step,
    duration_ms: duration,
    success,
    data: success ? data : undefined,
    error: data.error,
    timestamp: new Date().toISOString(),
  };

  pipelineSteps.push(stepData);

  console.log(`[PIPELINE:${step}]`, {
    timestamp: stepData.timestamp,
    duration_ms: duration,
    success,
    ...(success ? { data } : { error: data.error }),
  });

  // Optional: Send to monitoring service in debug mode
  if (Deno.env.get("DEBUG_MODE") === "true") {
    // Could send to Supabase table or external service
    // For now, just log to console
  }
}

/**
 * Get debug information about the pipeline execution
 */
export function getPipelineDebugInfo(): {
  steps: PipelineStep[];
  totalDuration: number;
  successRate: number;
} {
  const totalDuration = pipelineSteps.reduce(
    (sum, s) => sum + s.duration_ms,
    0,
  );
  const successCount = pipelineSteps.filter((s) => s.success).length;
  const successRate =
    pipelineSteps.length > 0 ? successCount / pipelineSteps.length : 0;

  return {
    steps: [...pipelineSteps], // Return copy to prevent mutation
    totalDuration,
    successRate,
  };
}

/**
 * Reset pipeline steps (call at start of each request)
 */
export function resetPipelineSteps(): void {
  pipelineSteps.length = 0;
}

/**
 * Get current step count
 */
export function getStepCount(): number {
  return pipelineSteps.length;
}

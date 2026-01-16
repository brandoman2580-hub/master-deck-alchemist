/**
 * Phase 2: Parallel Processing Utilities
 * Utilities for parallelizing independent operations to improve performance
 */

/**
 * Execute operations in parallel with timeout protection
 */
export async function parallelWithTimeout<T>(
  operations: Array<() => Promise<T>>,
  timeoutMs: number,
  failFast: boolean = false,
): Promise<Array<{ result?: T; error?: Error; index: number }>> {
  const promises = operations.map(async (op, index) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation ${index} timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const result = await Promise.race([op(), timeoutPromise]);
      return { result, index };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)), index };
    }
  });

  if (failFast) {
    // Use Promise.all for fail-fast behavior
    try {
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      // If one fails, return all with error
      return promises.map((_, index) => ({
        error: error instanceof Error ? error : new Error(String(error)),
        index,
      }));
    }
  } else {
    // Use Promise.allSettled for graceful degradation
    const settled = await Promise.allSettled(promises);
    return settled.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          index,
        };
      }
    });
  }
}

/**
 * Execute critical operations in parallel (fail-fast)
 */
export async function parallelCritical<T>(
  operations: Array<() => Promise<T>>,
  timeoutMs?: number,
): Promise<T[]> {
  const ops = timeoutMs
    ? operations.map(op => () => Promise.race([
        op(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]))
    : operations;

  return Promise.all(ops.map(op => op()));
}

/**
 * Execute optional operations in parallel (graceful degradation)
 */
export async function parallelOptional<T>(
  operations: Array<() => Promise<T>>,
  timeoutMs?: number,
): Promise<Array<T | null>> {
  const ops = timeoutMs
    ? operations.map(op => () => Promise.race([
        op(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]))
    : operations;

  const settled = await Promise.allSettled(ops.map(op => op()));
  return settled.map(result => (result.status === "fulfilled" ? result.value : null));
}

/**
 * Batch process items in parallel with concurrency limit
 */
export async function parallelBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

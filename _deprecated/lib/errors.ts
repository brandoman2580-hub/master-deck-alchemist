/**
 * Custom error types and error handling utilities
 * Following Next.js error handling best practices:
 * - Expected errors: Return error states explicitly
 * - Uncaught exceptions: Throw errors to be caught by error boundaries
 */

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required", details?: unknown) {
    super(message, "AUTH_ERROR", 401, details);
    this.name = "AuthenticationError";
  }
}

/**
 * Network/API request errors
 */
export class NetworkError extends AppError {
  constructor(
    message: string = "Network request failed",
    public readonly originalError?: unknown
  ) {
    super(message, "NETWORK_ERROR", 0, originalError);
    this.name = "NetworkError";
  }
}

/**
 * Data not found errors
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", details?: unknown) {
    super(message, "NOT_FOUND", 404, details);
    this.name = "NotFoundError";
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

/**
 * Result type for functions that can return either success or error
 * Useful for expected errors that should be handled explicitly
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper to create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function failure<E extends AppError = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper to wrap async functions that might throw
 * Converts thrown errors to Result type
 */
export async function toResult<T>(
  fn: () => Promise<T>
): Promise<Result<T, AppError>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    if (error instanceof AppError) {
      return failure(error);
    }
    if (error instanceof Error) {
      return failure(new AppError(error.message, "UNKNOWN_ERROR", undefined, error));
    }
    return failure(
      new AppError("An unknown error occurred", "UNKNOWN_ERROR", undefined, error)
    );
  }
}

/**
 * Helper to unwrap a Result, throwing if it's an error
 * Use this when you want errors to bubble up to error boundaries
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.success) {
    return result.data;
  }
  throw result.error;
}

/**
 * Helper to get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

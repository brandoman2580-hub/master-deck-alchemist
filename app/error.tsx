"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

/**
 * Root error boundary for the application
 * Catches uncaught exceptions that bubble up from child components
 * Following Next.js error handling best practices
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service in production
    // In development, errors are already logged to console
    if (process.env.NODE_ENV === "production") {
      // TODO: Send to error reporting service (e.g., Sentry, LogRocket)
      // Example: errorReportingService.captureException(error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Something went wrong!</h1>
        <p className="text-slate-300 mb-6">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-left">
            <p className="text-sm font-mono text-red-300 break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-400 mt-2">Error ID: {error.digest}</p>
            )}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

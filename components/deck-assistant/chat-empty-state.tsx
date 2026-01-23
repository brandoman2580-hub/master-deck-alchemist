"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openLoginModal } from "@/lib/helpers";

interface ChatEmptyStateProps {
  isAuthenticated: boolean;
  isDeckEmpty: boolean;
  error?: string | null;
}

export function ChatEmptyState({
  isAuthenticated,
  isDeckEmpty,
  error,
}: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-center px-4" style={{ minHeight: '100%' }}>
      {!isAuthenticated ? (
        <>
          <Lock className="h-12 w-12 text-white/40 mb-4" />
          <p className="text-white/70 text-sm mb-2 font-semibold">Authentication Required</p>
          <p className="text-white/50 text-xs mb-4">Please log in to use the AI Assistant.</p>
          <Button
            onClick={openLoginModal}
            className="bg-white/10 hover:bg-white/15 border border-white/20 text-white"
          >
            Log In
          </Button>
        </>
      ) : isDeckEmpty ? (
        <>
          <p className="text-white/70 text-sm mb-2 font-semibold">Start Building Your Deck</p>
          <p className="text-white/50 text-xs mb-1">Add cards to your deck from the Card Browser to get started.</p>
          <p className="text-white/50 text-xs">Once you have cards, I can help you optimize ratios, find synergies, and improve your deck!</p>
        </>
      ) : (
        <>
          <p className="text-white/70 text-sm mb-2">Ask me anything about your deck!</p>
          <p className="text-white/50 text-xs">I can help you find cards, improve consistency, or optimize ratios.</p>
        </>
      )}
      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}

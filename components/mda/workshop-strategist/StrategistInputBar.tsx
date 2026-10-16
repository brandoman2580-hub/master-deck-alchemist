"use client";

import { Search, Send } from "lucide-react";

interface StrategistInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

/**
 * Strategist chrome input bar — search icon, deck-question placeholder, cyan send.
 */
export function StrategistInputBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask questions about your deck",
  isLoading = false,
}: StrategistInputBarProps) {
  return (
    <form
      className="mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || isLoading || !value.trim()) return;
        onSubmit();
      }}
    >
      <label className="flex items-center gap-2 bg-mda-chrome px-3 py-2.5">
        <Search
          className="h-4 w-4 shrink-0 text-mda-inverse-text"
          aria-hidden
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          aria-label="Ask Strategist about your deck"
          className="w-full bg-transparent font-open-sans text-sm text-mda-inverse-text placeholder:font-mda placeholder:text-mda-cyan-soft focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || isLoading || !value.trim()}
          className="inline-flex size-11 shrink-0 items-center justify-center text-mda-cyan-soft transition-colors hover:text-mda-inverse-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </label>
    </form>
  );
}

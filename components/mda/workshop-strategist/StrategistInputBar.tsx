"use client";

import { Send } from "lucide-react";

interface StrategistInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

/**
 * Browser input: dark field on the sheet, send on the trailing edge.
 */
export function StrategistInputBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask about this deck...",
  isLoading = false,
}: StrategistInputBarProps) {
  return (
    <form
      className="shrink-0 border-t border-[#28303b] bg-[#e4ebf0] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || isLoading || !value.trim()) return;
        onSubmit();
      }}
    >
      <label className="flex items-center border border-[#28303b] bg-[#0c0e12]">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          aria-label="Ask Strategist about your deck"
          className="w-full border-0 bg-transparent px-3 py-2 text-[13px] text-[#e2e2e8] placeholder:text-[#8a96a6] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={disabled || isLoading || !value.trim()}
          className="flex h-9 items-center justify-center border-l border-[#28303b] px-3 text-[#8a96a6] transition-colors hover:text-[#f7fcff] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </label>
    </form>
  );
}

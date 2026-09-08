"use client";

import { Send, Lock } from "lucide-react";
import { InputWithClear } from "@/components/ui/input-with-clear";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { openLoginModal } from "@/lib/helpers";

interface ChatInputBarProps {
  inputValue: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDeckEmpty: boolean;
  assistantBlocked?: boolean;
  assistantBlockReasons?: string[];
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInputClear: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
}

export function ChatInputBar({
  inputValue,
  isLoading,
  isAuthenticated,
  isDeckEmpty,
  assistantBlocked = false,
  assistantBlockReasons = [],
  onInputChange,
  onInputClear,
  onKeyPress,
  onSend,
}: ChatInputBarProps) {
  const isDisabled = !isAuthenticated || isDeckEmpty || assistantBlocked;
  const blockHint =
    assistantBlockReasons[0] ??
    "Save a legal deck before using the AI Assistant.";

  return (
    <div className="border-t border-white/10 p-4 sm:p-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1 relative group">
                <InputWithClear
                  placeholder={
                    !isAuthenticated
                      ? "Please log in to use AI Assistant..."
                      : isDeckEmpty
                        ? "Add cards to your deck first..."
                        : assistantBlocked
                          ? "Save a legal deck to unlock AI Assistant..."
                          : "Ask about your deck..."
                  }
                  value={inputValue}
                  onChange={onInputChange}
                  onClear={onInputClear}
                  onKeyPress={onKeyPress}
                  disabled={isLoading || isDisabled}
                  aria-disabled={isDisabled}
                  className={`flex-1 h-9 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/50 focus-visible:outline-none rounded-lg transition-all duration-200 focus:border-white/30 focus:bg-white/10 ${
                    isDisabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
                {isDisabled && (
                  <Lock className="h-3 w-3 absolute right-3 top-1/2 -translate-y-1/2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                )}
              </div>
            </TooltipTrigger>
            {!isAuthenticated && (
              <TooltipContent>
                <p>Please log in to use this feature</p>
              </TooltipContent>
            )}
            {isAuthenticated && isDeckEmpty && (
              <TooltipContent>
                <p>Add cards to your deck first</p>
              </TooltipContent>
            )}
            {isAuthenticated && !isDeckEmpty && assistantBlocked && (
              <TooltipContent>
                <p>{blockHint}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  if (!isAuthenticated) {
                    openLoginModal();
                  } else if (isDeckEmpty || assistantBlocked) {
                    // Gate is explained via tooltip / empty state
                  } else {
                    onSend();
                  }
                }}
                disabled={!inputValue.trim() || isLoading || isDisabled}
                size="icon"
                aria-label="Send message"
                className={`h-9 w-9 flex-shrink-0 bg-white/10 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg relative group ${
                  !isDisabled ? "hover:bg-white/15" : ""
                }`}
              >
                <Send className="h-4 w-4" />
                {isDisabled && (
                  <Lock className="h-3 w-3 absolute -top-0.5 -right-0.5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
            </TooltipTrigger>
            {!isAuthenticated && (
              <TooltipContent>
                <p>Please log in to use this feature</p>
              </TooltipContent>
            )}
            {isAuthenticated && isDeckEmpty && (
              <TooltipContent>
                <p>Add cards to your deck first</p>
              </TooltipContent>
            )}
            {isAuthenticated && !isDeckEmpty && assistantBlocked && (
              <TooltipContent>
                <p>{blockHint}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

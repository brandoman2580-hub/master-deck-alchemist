"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, Clock } from "lucide-react";
import { DeckType } from "@/types/types";
import { useRouter } from "next/navigation";
import { useDeck } from "@/context/deck-context";

interface DeckSearchAutocompleteProps {
  decks: DeckType[];
  onDeckSelect?: (deckId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export function DeckSearchAutocomplete({ decks, onDeckSelect }: DeckSearchAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { loadDeck } = useDeck();

  // Get latest 5 edited decks (sorted by updated_at descending)
  const latestDecks = useMemo(() => {
    const decksWithDate = decks.filter((deck) => deck.updated_at);
    if (decksWithDate.length === 0) return [];
    
    return [...decksWithDate]
      .sort((a, b) => {
        const dateA = new Date(a.updated_at!).getTime();
        const dateB = new Date(b.updated_at!).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [decks]);

  // Filter decks by search query
  const filteredDecks = useMemo(() => {
    if (!search.trim()) return latestDecks;
    
    const query = search.toLowerCase();
    return decks
      .filter((deck) => deck.name.toLowerCase().includes(query))
      .slice(0, 5);
  }, [search, decks, latestDecks]);

  const handleSelect = async (deck: DeckType) => {
    setSearch("");
    setOpen(false);
    setSelectedIndex(-1);
    
    if (onDeckSelect) {
      onDeckSelect(deck.id);
    } else {
      try {
        await loadDeck(deck.id);
        router.push("/deck-builder");
      } catch (error) {
        console.error("Failed to load deck:", error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filteredDecks.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredDecks.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredDecks.length) {
          handleSelect(filteredDecks[selectedIndex]);
        } else if (filteredDecks.length > 0) {
          handleSelect(filteredDecks[0]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/60" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search decks or view recent..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="pl-10 bg-slate-950/60 border-cyan-500/50 text-slate-50 placeholder:text-slate-400 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/60 focus-visible:shadow-[0_0_20px_rgba(56,189,248,0.2)]"
        />
      </div>

      {open && filteredDecks.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {filteredDecks.map((deck, index) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => handleSelect(deck)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-4 py-3 hover:bg-cyan-500/20 transition-colors border-b border-cyan-500/10 last:border-b-0 ${
                selectedIndex === index ? "bg-cyan-500/20" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-50 truncate">{deck.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/40 border border-cyan-400/60 text-cyan-100 whitespace-nowrap">
                      {deck.mode}
                    </span>
                  </div>
                  {deck.updated_at && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>Last edited {formatRelativeTime(deck.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


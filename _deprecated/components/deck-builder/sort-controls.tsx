"use client";

import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SORT_OPTIONS } from "@/lib/constants";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { SPRING_CONFIG } from "@/lib/animations";

interface SortControlsProps {
  sort: string;
  sortDirection: "asc" | "desc";
  onSortChange: (sort: string) => void;
  onSortDirectionChange: (direction: "asc" | "desc") => void;
  deckMode: "TCG" | "Master Duel";
}

/**
 * Sort controls for the card browser: dropdown for sort attribute
 * and toggle for ascending/descending order.
 */
export function SortControls({
  sort,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
  deckMode,
}: SortControlsProps) {
  const handleDirectionToggle = () => {
    onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc");
  };

  // Filter out Master Duel-only options when in TCG mode
  const visibleOptions = SORT_OPTIONS.filter((opt) => {
    if (opt.value === "md_rarity" && deckMode === "TCG") return false;
    return true;
  });

  return (
    <div className="flex items-center gap-1.5">
      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger
          className="h-8 min-w-[100px] max-w-[140px] bg-white/5 border-white/10 text-white text-xs hover:bg-white/10 hover:border-white/20 focus:ring-white/20 data-[placeholder]:text-white/50"
          aria-label="Sort cards by"
        >
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent
          className="bg-slate-900/98 border-white/10 backdrop-blur-xl"
          side="bottom"
          align="end"
        >
          {visibleOptions.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="text-white focus:bg-white/10 focus:text-white"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: SPRING_CONFIG.gentle.tension,
          damping: SPRING_CONFIG.gentle.friction,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg"
          onClick={handleDirectionToggle}
          aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}. Click to toggle.`}
        >
          {sortDirection === "asc" ? (
            <ArrowUpAZ className="h-4 w-4" />
          ) : (
            <ArrowDownAZ className="h-4 w-4" />
          )}
        </Button>
      </motion.div>
    </div>
  );
}

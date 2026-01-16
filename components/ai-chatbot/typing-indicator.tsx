"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Enhanced typing indicator with animated dots
 * Shows when AI is processing a response
 */
export function TypingIndicator() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-cyan-400/60"
            animate={
              prefersReducedMotion
                ? {}
                : {
                    y: [0, -8, 0],
                    opacity: [0.5, 1, 0.5],
                  }
            }
            transition={
              prefersReducedMotion
                ? {}
                : {
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }
            }
          />
        ))}
      </div>
      <span className="text-xs text-white/60 ml-2">AI is thinking...</span>
    </motion.div>
  );
}

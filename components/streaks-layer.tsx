"use client";

import { motion } from "framer-motion";

export default function StreaksLayer({ y }: { y?: any }) {
  return (
    <motion.div
      style={y ? { y } : undefined}
      className="absolute inset-0 pointer-events-none z-[3]"
      aria-hidden
    >
      <div className="streaks-layer" />
    </motion.div>
  );
}

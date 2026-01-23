"use client";

import { motion } from "framer-motion";

export function ChatLoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 mt-4"
    >
      <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1">
          <motion.div
            className="w-2 h-2 bg-white/60 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-2 h-2 bg-white/60 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 bg-white/60 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
          />
        </div>
        <span className="text-white/70 text-sm">Thinking...</span>
      </div>
    </motion.div>
  );
}

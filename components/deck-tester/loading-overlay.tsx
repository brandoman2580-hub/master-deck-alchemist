"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { fadeInVariants } from "@/lib/animations";

type TestType = "matchup_analysis" | "duel_simulation" | "strategic_insights";

interface LoadingOverlayProps {
  isLoading: boolean;
  testType: TestType;
  numSimulations: number;
}

export function LoadingOverlay({
  isLoading,
  testType,
  numSimulations,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 pointer-events-none"
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
    >
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Loader2 className="h-8 w-8 text-white/80" />
        </motion.div>
        <motion.div
          className="text-white/90 font-medium"
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {testType === "duel_simulation"
            ? `Simulating ${numSimulations} duels...`
            : "Analyzing matchup..."}
        </motion.div>
      </div>
    </motion.div>
  );
}


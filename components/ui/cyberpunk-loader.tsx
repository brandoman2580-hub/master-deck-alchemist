"use client";

import { motion } from "framer-motion";

interface CyberpunkLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-8 h-8",
  md: "w-16 h-16",
  lg: "w-24 h-24",
};

export function CyberpunkLoader({ size = "md", className = "" }: CyberpunkLoaderProps) {
  return (
    <div className={`relative ${sizeMap[size]} ${className}`}>
      {/* Outer rotating ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
        animate={{ rotate: 360 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Middle pulsing ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-cyan-500/50"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner core with glow */}
      <motion.div
        className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600"
        animate={{
          scale: [1, 1.1, 1],
          boxShadow: [
            "0 0 10px rgba(56, 189, 248, 0.5)",
            "0 0 20px rgba(56, 189, 248, 0.8)",
            "0 0 10px rgba(56, 189, 248, 0.5)",
          ],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Scanning line effect */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent, cyan-400, transparent)",
          maskImage: "radial-gradient(circle, transparent 30%, black 50%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 30%, black 50%)",
        }}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-1 h-1 rounded-full bg-cyan-400"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}

// Full-screen loader variant
export function CyberpunkLoaderFullScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm">
      <CyberpunkLoader size="lg" />
      <motion.p
        className="mt-8 text-cyan-400 text-lg font-display tracking-wider uppercase"
        style={{ fontFamily: "var(--font-heading)" }}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {message}
      </motion.p>
    </div>
  );
}

// Inline loader variant
export function CyberpunkLoaderInline({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <CyberpunkLoader size="md" />
      {message && (
        <motion.p
          className="mt-4 text-cyan-400 text-sm font-display tracking-wider uppercase"
          style={{ fontFamily: "var(--font-heading)" }}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}


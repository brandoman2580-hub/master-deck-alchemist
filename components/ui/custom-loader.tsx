"use client";

import { motion } from "framer-motion";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-8 h-8",
  md: "w-16 h-16",
  lg: "w-24 h-24",
};

export function Loader({
  size = "md",
  className = "",
}: LoaderProps) {
  return (
    <div className={`relative ${sizeMap[size]} ${className}`}>
      {/* Outer rotating ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-white/20 backdrop-blur-sm"
        animate={{ rotate: 360 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Middle pulsing ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-white/30 backdrop-blur-sm"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Inner core with glassmorphic glow */}
      <motion.div
        className="absolute inset-4 rounded-full bg-white/20 backdrop-blur-md border border-white/30"
        animate={{
          scale: [1, 1.1, 1],
          boxShadow: [
            "0 0 10px rgba(255, 255, 255, 0.2)",
            "0 0 20px rgba(255, 255, 255, 0.3)",
            "0 0 10px rgba(255, 255, 255, 0.2)",
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
          background:
            "conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.3), transparent)",
          maskImage: "radial-gradient(circle, transparent 30%, black 50%)",
          WebkitMaskImage:
            "radial-gradient(circle, transparent 30%, black 50%)",
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
          className="w-1 h-1 rounded-full bg-white/80 backdrop-blur-sm"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.6, 1, 0.6],
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
export function LoaderFullScreen({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
      <Loader size="lg" />
      <motion.p
        className="mt-8 text-white/80 text-lg font-display tracking-wider"
        style={{ fontFamily: "var(--font-heading)" }}
        animate={{
          opacity: [0.6, 1, 0.6],
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
export function LoaderInline({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader size="md" />
      {message && (
        <motion.p
          className="mt-4 text-white/70 text-sm font-display tracking-wider"
          style={{ fontFamily: "var(--font-heading)" }}
          animate={{
            opacity: [0.6, 1, 0.6],
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

// Legacy exports for backward compatibility
export const CyberpunkLoader = Loader;
export const CyberpunkLoaderFullScreen = LoaderFullScreen;
export const CyberpunkLoaderInline = LoaderInline;

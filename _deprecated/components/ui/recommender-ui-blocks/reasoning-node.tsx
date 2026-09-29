"use client";

import { motion } from "framer-motion";

interface ReasoningNodeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accentClassName: string;
  children: React.ReactNode;
}

export function ReasoningNode({
  icon: Icon,
  label,
  accentClassName,
  children,
}: ReasoningNodeProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      className="relative"
    >
      <div
        className={`absolute left-[-29px] top-1 w-8 h-8 rounded-full border flex items-center justify-center ${accentClassName}`}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Zap,
  Shield,
  Target,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface QuickAction {
  label: string;
  question: string;
  icon: LucideIcon;
  color: string;
  description: string;
}

export const quickActions: QuickAction[] = [
  {
    label: "Improve Consistency",
    question: "How can I improve my deck's draw consistency and reduce bricking?",
    icon: TrendingUp,
    color: "cyan",
    description: "Find cards that reduce bricking",
  },
  {
    label: "Boost ATK Power",
    question: "What cards can I add to increase my monster ATK power?",
    icon: Zap,
    color: "red",
    description: "Increase offensive capabilities",
  },
  {
    label: "Add Interruptions",
    question: "What interruption and defensive cards should I add?",
    icon: Shield,
    color: "blue",
    description: "Stop opponent combos",
  },
  {
    label: "Counter Meta",
    question: "What cards counter the current meta threats?",
    icon: Target,
    color: "orange",
    description: "Beat top tier decks",
  },
  {
    label: "Find Synergies",
    question: "What hidden synergies work with my deck?",
    icon: Sparkles,
    color: "purple",
    description: "Discover non-obvious support",
  },
];

interface QuickActionsProps {
  onSelect: (action: QuickAction) => void;
  isLoading: boolean;
}

export function QuickActions({ onSelect, isLoading }: QuickActionsProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4 py-3"
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="visible"
    >
      {quickActions.map((action) => {
        const Icon = action.icon;
        const colorClasses = {
          cyan: {
            bg: "from-cyan-500/10 via-cyan-400/5 to-cyan-500/10",
            border: "border-cyan-400/20 hover:border-cyan-400/40",
            shadow: "hover:shadow-cyan-500/20",
            iconBg: "bg-cyan-500/20 border-cyan-400/30",
            iconColor: "text-cyan-400",
            hoverGradient: "from-cyan-500/20",
          },
          red: {
            bg: "from-red-500/10 via-red-400/5 to-red-500/10",
            border: "border-red-400/20 hover:border-red-400/40",
            shadow: "hover:shadow-red-500/20",
            iconBg: "bg-red-500/20 border-red-400/30",
            iconColor: "text-red-400",
            hoverGradient: "from-red-500/20",
          },
          blue: {
            bg: "from-blue-500/10 via-blue-400/5 to-blue-500/10",
            border: "border-blue-400/20 hover:border-blue-400/40",
            shadow: "hover:shadow-blue-500/20",
            iconBg: "bg-blue-500/20 border-blue-400/30",
            iconColor: "text-blue-400",
            hoverGradient: "from-blue-500/20",
          },
          orange: {
            bg: "from-orange-500/10 via-orange-400/5 to-orange-500/10",
            border: "border-orange-400/20 hover:border-orange-400/40",
            shadow: "hover:shadow-orange-500/20",
            iconBg: "bg-orange-500/20 border-orange-400/30",
            iconColor: "text-orange-400",
            hoverGradient: "from-orange-500/20",
          },
          purple: {
            bg: "from-purple-500/10 via-purple-400/5 to-purple-500/10",
            border: "border-purple-400/20 hover:border-purple-400/40",
            shadow: "hover:shadow-purple-500/20",
            iconBg: "bg-purple-500/20 border-purple-400/30",
            iconColor: "text-purple-400",
            hoverGradient: "from-purple-500/20",
          },
        };

        const colors = colorClasses[action.color as keyof typeof colorClasses];

        return (
          <motion.button
            key={action.label}
            variants={staggerItem}
            onClick={() => onSelect(action)}
            disabled={isLoading}
            className={`
              group relative overflow-hidden
              p-4 rounded-xl
              bg-gradient-to-br ${colors.bg}
              border ${colors.border}
              backdrop-blur-sm
              transition-all duration-300
              shadow-lg
              ${colors.shadow}
              hover:scale-[1.02]
              active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            whileHover={prefersReducedMotion || isLoading ? {} : { y: -2 }}
            whileTap={prefersReducedMotion || isLoading ? {} : { scale: 0.98 }}
          >
            {/* Animated background gradient */}
            <motion.div
              className={`absolute inset-0 bg-gradient-to-br ${colors.hoverGradient} to-transparent opacity-0 group-hover:opacity-100`}
              transition={{ duration: 0.3 }}
            />

            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className={`p-2 rounded-lg ${colors.iconBg}`}>
                <Icon className={`h-5 w-5 ${colors.iconColor}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-white">{action.label}</p>
                <p className="text-xs text-white/60 mt-0.5">{action.description}</p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({
  questions,
  onSelect,
}: SuggestedQuestionsProps) {
  const prefersReducedMotion = useReducedMotion();

  if (questions.length === 0) return null;

  return (
    <motion.div
      className="flex flex-wrap gap-2 px-4 py-2"
      variants={staggerContainer(0.03)}
      initial="hidden"
      animate="visible"
    >
      {questions.map((question, index) => (
        <motion.button
          key={index}
          variants={staggerItem}
          onClick={() => onSelect(question)}
          className={`
            px-4 py-2 rounded-full
            bg-white/5 border border-white/10
            text-sm text-white/80
            backdrop-blur-sm
            transition-all duration-200
            hover:bg-white/10 hover:border-white/20
            hover:text-white
            hover:scale-105
            active:scale-95
          `}
          whileHover={prefersReducedMotion ? {} : { y: -2 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        >
          {question}
        </motion.button>
      ))}
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { fadeInVariants } from "@/lib/animations";

export function EmptyState() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
    >
      <Card className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-lg">
        <CardContent className="pt-12 pb-12">
          <div className="text-center text-white/70">
            <Zap className="h-12 w-12 mx-auto mb-4 text-white/50" />
            <p>Select decks and run an AI test to see results</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";

export function EmptyState() {
  return (
    <Card className="bg-gradient-to-b from-cyan-400/20 via-cyan-500/15 to-cyan-600/5 backdrop-blur-md border border-accent-cyan/18">
      <CardContent className="pt-12 pb-12">
        <div className="text-center text-muted-50/70">
          <Zap className="h-12 w-12 mx-auto mb-4 text-accent-cyan/50" />
          <p>Select decks and run an AI test to see results</p>
        </div>
      </CardContent>
    </Card>
  );
}


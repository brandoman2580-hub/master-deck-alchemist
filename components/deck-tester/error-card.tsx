"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

interface ErrorCardProps {
  error: string | null;
  onDismiss: () => void;
}

export function ErrorCard({ error, onDismiss }: ErrorCardProps) {
  if (!error) return null;

  return (
    <Card className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-xl shadow-lg">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-red-300">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-6 w-6"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


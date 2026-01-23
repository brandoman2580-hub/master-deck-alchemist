"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex justify-end">
            <Skeleton className="h-8 w-48 bg-white/10" />
          </div>
          <div className="flex justify-start">
            <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl px-4 py-3 max-w-[80%] space-y-2">
              <Skeleton className="h-4 w-full bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <Skeleton className="h-32 w-full bg-white/10 rounded-lg mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

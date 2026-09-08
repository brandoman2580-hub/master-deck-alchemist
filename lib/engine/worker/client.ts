import {
  simulateConsistency,
  type TaggedMainCard,
} from "../consistency";
import type { ConsistencyStats } from "../types";

type Pending = {
  resolve: (value: ConsistencyStats) => void;
  reject: (reason?: unknown) => void;
};

let worker: Worker | null = null;
let workerFailed = false;
const pending = new Map<string, Pending>();

function getWorker(): Worker | null {
  if (workerFailed || typeof window === "undefined") return null;
  if (worker) return worker;

  try {
    worker = new Worker(
      new URL("./consistency.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: string;
        requestId: string;
        consistency: ConsistencyStats;
      };
      if (data?.type !== "result") return;
      const entry = pending.get(data.requestId);
      if (!entry) return;
      pending.delete(data.requestId);
      entry.resolve(data.consistency);
    };
    worker.onerror = () => {
      workerFailed = true;
      worker?.terminate();
      worker = null;
      for (const [, entry] of pending) {
        entry.reject(new Error("Consistency worker failed"));
      }
      pending.clear();
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

/**
 * Run consistency Monte Carlo in a Web Worker when available; sync fallback otherwise.
 */
export function runConsistencySimulation(
  mainDeck: TaggedMainCard[],
  iterations = 3000,
): Promise<ConsistencyStats> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(
      simulateConsistency(mainDeck, { iterations }),
    );
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    w.postMessage({
      type: "simulate",
      requestId,
      mainDeck,
      iterations,
    });
  });
}

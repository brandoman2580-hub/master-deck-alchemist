/**
 * Consistency worker — runs Monte Carlo off the UI thread.
 * Bundlers that support `new Worker(new URL(...), { type: 'module' })` can load this.
 */

import {
  simulateConsistency,
  type TaggedMainCard,
} from "../consistency";

export type ConsistencyWorkerRequest = {
  type: "simulate";
  requestId: string;
  mainDeck: TaggedMainCard[];
  iterations?: number;
};

export type ConsistencyWorkerResponse = {
  type: "result";
  requestId: string;
  consistency: ReturnType<typeof simulateConsistency>;
};

self.onmessage = (event: MessageEvent<ConsistencyWorkerRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== "simulate") return;

  const consistency = simulateConsistency(msg.mainDeck, {
    iterations: msg.iterations ?? 3000,
  });

  const response: ConsistencyWorkerResponse = {
    type: "result",
    requestId: msg.requestId,
    consistency,
  };
  self.postMessage(response);
};

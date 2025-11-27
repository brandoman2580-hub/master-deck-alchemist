/**
 * MMR (Maximal Marginal Relevance) reranking utility
 * Balances relevance to query with diversity among results
 */

// Helper functions for vector similarity
function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function norm(a: number[]): number {
  return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
}

function cosine(a: number[], b: number[]): number {
  const n = norm(a) * norm(b);
  return n === 0 ? 0 : dot(a, b) / n;
}

export interface MMRCandidate {
  id: number;
  embedding: number[] | null;
  sim: number;
  row: any;
}

/**
 * MMR (Maximal Marginal Relevance) reranker
 * Balances relevance to query with diversity among results
 * 
 * @param candidates - Array of candidates with embeddings and similarity scores
 * @param qEmb - Query embedding vector
 * @param k - Number of items to select
 * @param lambda - Balance factor (0-1): higher = more relevance, lower = more diversity. Default 0.65
 * @returns Selected candidates ranked by MMR score
 */
export function mmrSelect(
  candidates: MMRCandidate[],
  qEmb: number[],
  k: number,
  lambda = 0.65
): MMRCandidate[] {
  // Compute similarity to query for all candidates
  candidates.forEach((c) => {
    if (c.embedding && c.sim === 0) {
      c.sim = cosine(c.embedding, qEmb);
    }
  });

  const selected: MMRCandidate[] = [];
  const pool = candidates.slice();

  // Sort by similarity (descending)
  pool.sort((a, b) => (b.sim ?? 0) - (a.sim ?? 0));

  // Select first item (most relevant)
  if (pool.length === 0) return selected;
  selected.push(pool.shift()!);

  // MMR selection: balance relevance and diversity
  while (selected.length < k && pool.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      const rel = cand.sim ?? 0;

      // Diversity penalty = max similarity to any already selected item
      const diversity =
        selected.length > 0
          ? Math.max(
              ...selected.map((s) =>
                s.embedding && cand.embedding
                  ? cosine(s.embedding, cand.embedding)
                  : 0
              )
            )
          : 0;

      // MMR score: higher is better
      const mmrScore = lambda * rel - (1 - lambda) * diversity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    selected.push(pool.splice(bestIdx, 1)[0]);
  }

  return selected;
}



export const RRF_K = 60;

export const DEFAULT_RRF_WEIGHTS = {
  hybrid: {
    bm25: 0.45,
    tfidf: 0.25,
    vector: 0.3
  },
  fallback: {
    bm25: 0.65,
    tfidf: 0.35
  }
};

export function rrf3way(bm25Ranked, tfidfRanked, vectorRanked, weights = DEFAULT_RRF_WEIGHTS.hybrid) {
  const scores = new Map();

  const add = (list, weight) => {
    list.forEach((item, index) => {
      const id = item.chunk.id;
      if (!scores.has(id)) {
        scores.set(id, { chunk: item.chunk, score: 0 });
      }

      scores.get(id).score += weight * (1 / (RRF_K + index + 1));
    });
  };

  add(bm25Ranked, weights.bm25);
  add(tfidfRanked, weights.tfidf);
  add(vectorRanked, weights.vector);

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

export function rrf2way(bm25Ranked, tfidfRanked, weights = DEFAULT_RRF_WEIGHTS.fallback) {
  const scores = new Map();

  const add = (list, weight) => {
    list.forEach((item, index) => {
      const id = item.chunk.id;
      if (!scores.has(id)) {
        scores.set(id, { chunk: item.chunk, score: 0 });
      }

      scores.get(id).score += weight * (1 / (RRF_K + index + 1));
    });
  };

  add(bm25Ranked, weights.bm25);
  add(tfidfRanked, weights.tfidf);

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}

export function rrf(list, weights) {
  if (list.vector?.length) {
    return rrf3way(list.bm25 || [], list.tfidf || [], list.vector, weights?.hybrid);
  }

  return rrf2way(list.bm25 || [], list.tfidf || [], weights?.fallback);
}

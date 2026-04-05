export const MMR_LAMBDA = 0.6;

function jaccardSimilarity(a, b) {
  const setA = new Set(a.tokens);
  const setB = new Set(b.tokens);
  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function mmrSelect(candidates, k, similarity = jaccardSimilarity) {
  if (candidates.length <= k) return candidates;

  const selected = [];
  const remaining = [...candidates];

  while (selected.length < k && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const relevance = remaining[i].score;
      let maxSimilarity = 0;

      for (const selectedItem of selected) {
        const sim = similarity(remaining[i].chunk, selectedItem.chunk);
        if (sim > maxSimilarity) maxSimilarity = sim;
      }

      const mmrScore = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    selected.push(remaining[bestIndex]);
    remaining.splice(bestIndex, 1);
  }

  return selected;
}

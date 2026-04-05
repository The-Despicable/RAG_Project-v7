export function hitAtK(retrieved, expected) {
  return retrieved.some((id) => expected.includes(id)) ? 1 : 0;
}

export function recallAtK(retrieved, expected) {
  if (!expected.length) return 0;
  const hits = retrieved.filter((id) => expected.includes(id));
  return hits.length / expected.length;
}

export function mrr(retrieved, expected) {
  for (let i = 0; i < retrieved.length; i += 1) {
    if (expected.includes(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

export function precisionAtK(retrieved, expected, k) {
  if (!k || k <= 0) return 0;
  const topK = retrieved.slice(0, k);
  const hits = topK.filter((id) => expected.includes(id));
  return hits.length / k;
}

export function ndcg(retrieved, expected) {
  let dcg = 0;
  for (let i = 0; i < retrieved.length; i += 1) {
    if (expected.includes(retrieved[i])) {
      dcg += 1 / Math.log2(i + 2);
    }
  }

  let idcg = 0;
  for (let i = 0; i < expected.length; i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
}

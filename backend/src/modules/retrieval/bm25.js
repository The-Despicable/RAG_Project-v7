export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

export function buildTFRaw(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  return tf;
}

export function buildTF(tokens) {
  const tf = buildTFRaw(tokens);
  let max = 1;

  for (const value of Object.values(tf)) {
    if (value > max) max = value;
  }

  for (const key of Object.keys(tf)) {
    tf[key] /= max;
  }

  return tf;
}

export function computeIDF(chunks) {
  const idf = {};
  const df = {};
  const total = chunks.length;

  if (total === 0) {
    return { idf, avgDocLen: 0 };
  }

  for (const chunk of chunks) {
    const unique = new Set(chunk.tokens);
    for (const token of unique) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  for (const token of Object.keys(df)) {
    idf[token] = Math.log((total - df[token] + 0.5) / (df[token] + 0.5) + 1);
  }

  const avgDocLen = chunks.reduce((sum, chunk) => sum + chunk.tokens.length, 0) / total;
  return { idf, avgDocLen };
}

export function bm25Score(chunk, queryTokens, idf, avgDocLen) {
  const tfRaw = chunk.tf_raw;
  const docLength = chunk.tokens.length;
  let score = 0;
  const seen = new Set();

  for (const token of queryTokens) {
    if (seen.has(token)) continue;
    seen.add(token);

    const freq = tfRaw[token] || 0;
    if (freq === 0) continue;

    const tokenIdf = idf[token] || 0;
    const tfNorm = (freq * (BM25_K1 + 1)) /
      (freq + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / (avgDocLen || 1))));

    score += tokenIdf * tfNorm;
  }

  return score;
}

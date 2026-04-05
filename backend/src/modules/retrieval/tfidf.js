import { buildTF } from "./bm25.js";

export function tfidfVector(tokens, idf) {
  const tf = buildTF(tokens);
  const vector = {};

  for (const token of Object.keys(tf)) {
    vector[token] = tf[token] * (idf[token] || 1);
  }

  return vector;
}

export function cosineSim(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const key in a) {
    const value = a[key];
    normA += value * value;
    if (b[key]) dot += value * b[key];
  }

  for (const key in b) {
    const value = b[key];
    normB += value * value;
  }

  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

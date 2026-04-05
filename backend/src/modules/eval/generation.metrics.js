import { embed } from "../../utils/embed.js";

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2);
}

export function answerMatch(answer, expected) {
  if (!expected) return 0;

  const answerTokens = new Set(tokenize(answer));
  const expectedTokens = new Set(tokenize(expected));
  const intersection = [...answerTokens].filter((token) => expectedTokens.has(token));
  const union = new Set([...answerTokens, ...expectedTokens]);

  return union.size === 0 ? 0 : intersection.length / union.size;
}

export function citationCoverage(answer, citations) {
  const hasMarkers = /\[\d+\]/.test(String(answer || ""));
  const hasMapped = Array.isArray(citations) && citations.length > 0;
  return hasMarkers && hasMapped ? 1 : 0;
}

export function refusalAccuracy(answer, shouldRefuse) {
  const refused = String(answer || "").includes("Not found in provided documents");
  if (shouldRefuse) return refused ? 1 : 0;
  return refused ? 0 : 1;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function groundedness(answer, chunks) {
  if (!chunks || chunks.length === 0) return 0;

  const answerEmbedding = await embed(answer);
  const similarities = chunks
    .map((item) => cosineSimilarity(answerEmbedding, item?.chunk?.embedding || item?.embedding))
    .filter((score) => Number.isFinite(score) && score > 0)
    .sort((a, b) => b - a);

  if (similarities.length === 0) return 0;
  if (similarities.length === 1) return similarities[0];

  return (similarities[0] + similarities[1]) / 2;
}

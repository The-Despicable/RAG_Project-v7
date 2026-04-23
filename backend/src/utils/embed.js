import { withRetry } from "../utils/retry.js";
import { recordLatency, recordError } from "../utils/metrics.js";

function formatEmbeddingEndpoint() {
  return process.env.OPENROUTER_EMBEDDING_URL || "https://openrouter.ai/api/v1/embeddings";
}

function embeddingDimensions() {
  const raw = process.env.OPENROUTER_EMBEDDING_DIMENSIONS || "384";
  return Number(raw);
}

function validateApiKey() {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.trim() === "") {
    console.error("FATAL: OPENROUTER_API_KEY not set. Embeddings cannot be generated.");
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }
}

export function formatVectorLiteral(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Embedding vector is empty or invalid.");
  }
  return `[${vector.map((v)=>Number(v)).join(",")}]`;
}

export async function embed(text) {
  validateApiKey();
  const apiKey = process.env.OPENROUTER_API_KEY.trim();
  const model = process.env.OPENROUTER_EMBEDDING_MODEL || "text-embedding-3-small";
  const dimensions = embeddingDimensions();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");
  const start = process.hrtime.bigint();
  try {
    const result = await withRetry(async () => {
      const response = await fetch(formatEmbeddingEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: text, dimensions })
      });
      if (!response.ok) { const b = await response.text(); throw new Error(`Embedding failed: HTTP ${response.status}: ${b}`); }
      const data = await response.json(); const vector = data?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0 || vector.length !== dimensions) {
        throw new Error("Invalid embedding response");
      }
      return vector;
    }, { maxAttempts: 3, baseDelayMs: 1000 });
    recordLatency("embedding", Number(process.hrtime.bigint() - start) / 1e6);
    return result;
  } catch (error) { recordError("embedding"); throw error; }
}
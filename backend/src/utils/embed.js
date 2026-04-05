import { withRetry } from "../utils/retry.js";
import { recordLatency, recordError } from "../utils/metrics.js";

function formatEmbeddingEndpoint() {
  return process.env.OPENROUTER_EMBEDDING_URL || "https://openrouter.ai/api/v1/embeddings";
}

function embeddingDimensions() {
  const raw = process.env.OPENROUTER_EMBEDDING_DIMENSIONS || "384";
  return Number(raw);
}

export function formatVectorLiteral(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Embedding vector is empty or invalid.");
  }

  return `[${vector.map((value) => Number(value)).join(",")}]`;
}

export async function embed(text) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL || "text-embedding-3-small";
  const dimensions = embeddingDimensions();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const start = process.hrtime.bigint();
  try {
    const result = await withRetry(async () => {
      const response = await fetch(formatEmbeddingEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          input: text,
          dimensions
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Embedding request failed with HTTP ${response.status}: ${body}`);
      }

      const data = await response.json();
      const vector = data?.data?.[0]?.embedding;

      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("Embedding response did not include a usable vector.");
      }

      if (vector.length !== dimensions) {
        throw new Error(`Embedding response dimension mismatch. Expected ${dimensions}, got ${vector.length}.`);
      }

      return vector;
    }, { maxAttempts: 3, baseDelayMs: 1000 });
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    recordLatency("embedding", elapsed);
    return result;
  } catch (error) {
    recordError("embedding");
    throw error;
  }
}

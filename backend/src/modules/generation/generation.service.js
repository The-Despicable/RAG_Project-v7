import { buildPrompt } from "./prompt.builder.js";
import { generate } from "./llm.client.js";

function extractCitations(answer, chunks) {
  const matches = answer.match(/\[(\d+)\]/g) || [];
  const seen = new Set();

  return matches
    .map((match) => Number(match.replace(/\D/g, "")) - 1)
    .filter((index) => Number.isInteger(index) && index >= 0 && chunks[index] && !seen.has(index) && seen.add(index))
    .map((index) => ({
      id: chunks[index].chunk.id,
      docId: chunks[index].chunk.docId,
      docName: chunks[index].chunk.docName,
      chunkIndex: chunks[index].chunk.chunkIndex
    }));
}

export async function generateAnswer({ query, chunks, apiKey, baseUrl, model, provider }) {
  if (!chunks || chunks.length === 0) {
    return {
      answer: "Not found in provided documents.",
      citations: [],
      provider: null,
      model: null
    };
  }

  const prompt = buildPrompt({ query, chunks });
  const generated = await generate({
    prompt,
    apiKey,
    baseUrl,
    model,
    provider
  });

  const answer = generated.answer || "Not found in provided documents.";

  return {
    answer,
    citations: extractCitations(answer, chunks),
    provider: generated.provider,
    model: generated.model
  };
}

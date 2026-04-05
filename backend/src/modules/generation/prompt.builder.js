export function buildPrompt({ query, chunks }) {
  const context = chunks.map((item, index) => {
    const chunk = item.chunk || item;
    return `[${index + 1}] (${chunk.docName})\n${chunk.text}`;
  }).join("\n\n");

  return {
    system: [
      "You are a strict retrieval-based assistant.",
      "Answer ONLY using the provided context.",
      "Do NOT make up information.",
      "If the answer is not in the context, say: \"Not found in provided documents.\"",
      "Always cite sources using [number]."
    ].join("\n"),
    user: `Question:\n${query}\n\nContext:\n${context}\n\nAnswer:`
  };
}

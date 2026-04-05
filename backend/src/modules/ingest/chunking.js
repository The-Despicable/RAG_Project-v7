import { tokenize } from "../../utils/tokenizer.js";

export function autoChunkSize(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  if (words > 50000) return { size: 600, overlap: 100 };
  if (words > 10000) return { size: 400, overlap: 75 };
  return { size: 300, overlap: 50 };
}

export function chunkText(text, options = {}) {
  const source = String(text || "").trim();
  if (!source) return [];

  const auto = autoChunkSize(source);
  const chunkSize = Number(options.chunkSize || auto.size);
  const overlap = Number(options.chunkOverlap || auto.overlap);
  const words = source.split(/\s+/).filter(Boolean);
  const chunks = [];
  let index = 0;
  let cursor = 0;

  while (cursor < words.length) {
    const slice = words.slice(cursor, cursor + chunkSize);
    if (slice.length < 10 && chunks.length > 0) {
      chunks[chunks.length - 1].content += ` ${slice.join(" ")}`;
      chunks[chunks.length - 1].token_count = tokenize(chunks[chunks.length - 1].content).length;
      break;
    }

    const content = slice.join(" ");
    chunks.push({
      chunk_index: index,
      content,
      token_count: tokenize(content).length
    });

    index += 1;
    cursor += Math.max(1, chunkSize - overlap);
  }

  return chunks;
}

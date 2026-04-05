export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do",
  "does", "did", "will", "would", "could", "should", "may", "might", "shall",
  "i", "you", "he", "she", "it", "we", "they", "this", "that", "these", "those",
  "not", "no", "if", "as", "by", "from", "up", "about", "into", "through", "then",
  "than", "so", "what", "which", "who", "how", "all", "each", "more", "also"
]);

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

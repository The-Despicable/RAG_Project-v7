import { pool } from "../../db/client.js";
import { embed, formatVectorLiteral } from "../../utils/embed.js";
import { tokenize } from "../../utils/tokenizer.js";
import { bm25Score, buildTF, buildTFRaw, computeIDF } from "./bm25.js";
import { mmrSelect } from "./mmr.js";
import { rrf2way, rrf3way } from "./rrf.js";
import { cosineSim, tfidfVector } from "./tfidf.js";
import { recordLatency, recordError } from "../../utils/metrics.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 100;
const cache = new Map();

function cacheKey(query, mode, topK) {
  return `${query}:${mode}:${topK}`;
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, timestamp: Date.now() });
}

function decorateChunk(row) {
  const tokens = tokenize(row.content);
  const embedding = parseVectorLiteral(row.embedding);

  return {
    id: row.id,
    docId: row.document_id,
    docName: row.document_name,
    text: row.content,
    chunkIndex: row.chunk_index,
    embedding,
    metadata: row.metadata || {},
    tokens,
    tf: buildTF(tokens),
    tf_raw: buildTFRaw(tokens)
  };
}

function parseVectorLiteral(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];

  return inner.split(",").map((part) => Number(part.trim()));
}

function keywordPrefilter(chunks, queryTokens, minOverlap = 1) {
  const querySet = new Set(queryTokens);

  return chunks.filter((chunk) => {
    let overlap = 0;

    for (const token of chunk.tokens) {
      if (querySet.has(token)) {
        overlap += 1;
        if (overlap >= minOverlap) return true;
      }
    }

    return false;
  });
}

async function fetchCandidateRows({ query, filters = {}, limit = 200, userId = null }) {
  const values = [query];
  const conditions = ["c.content_tsvector @@ plainto_tsquery('simple', $1)"];
  let paramIndex = values.length + 1;

  if (userId) {
    conditions.push(`d.metadata->>'userId' = $${paramIndex}`);
    values.push(userId);
    paramIndex += 1;
  }

  if (filters.documentId) {
    conditions.push(`c.document_id = $${paramIndex}`);
    values.push(filters.documentId);
    paramIndex += 1;
  }

  if (filters.sourceType) {
    conditions.push(`d.source_type = $${paramIndex}`);
    values.push(filters.sourceType);
    paramIndex += 1;
  }

  values.push(limit);

  const result = await pool.query(`
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.chunk_index,
      c.embedding,
      c.metadata,
      d.name AS document_name
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.status = 'ready' AND ${conditions.join(" AND ")}
    ORDER BY c.chunk_index ASC
    LIMIT $${paramIndex}
  `, values);

  if (result.rows.length > 0) {
    return result.rows;
  }

  const fallbackValues = [];
  const fallbackConditions = [];
  let fallbackIndex = 1;

  if (userId) {
    fallbackConditions.push(`d.metadata->>'userId' = $${fallbackIndex}`);
    fallbackValues.push(userId);
    fallbackIndex += 1;
  }

  if (filters.documentId) {
    fallbackConditions.push(`c.document_id = $${fallbackIndex}`);
    fallbackValues.push(filters.documentId);
    fallbackIndex += 1;
  }

  if (filters.sourceType) {
    fallbackConditions.push(`d.source_type = $${fallbackIndex}`);
    fallbackValues.push(filters.sourceType);
    fallbackIndex += 1;
  }

  fallbackValues.push(limit);

  const fallbackWhere = fallbackConditions.length
    ? `WHERE d.status = 'ready' AND ${fallbackConditions.join(" AND ")}`
    : "WHERE d.status = 'ready'";

  const fallback = await pool.query(`
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.chunk_index,
      c.embedding,
      c.metadata,
      d.name AS document_name
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    ${fallbackWhere}
    ORDER BY c.created_at DESC
    LIMIT $${fallbackIndex}
  `, fallbackValues);

  return fallback.rows;
}

async function fetchVectorCandidateRows({ queryEmbedding, filters = {}, limit = 50, userId = null }) {
  const vectorLiteral = formatVectorLiteral(queryEmbedding);
  const values = [vectorLiteral];
  const conditions = ["c.embedding IS NOT NULL"];
  let paramIndex = values.length + 1;

  if (userId) {
    conditions.push(`d.metadata->>'userId' = $${paramIndex}`);
    values.push(userId);
    paramIndex += 1;
  }

  if (filters.documentId) {
    conditions.push(`c.document_id = $${paramIndex}`);
    values.push(filters.documentId);
    paramIndex += 1;
  }

  if (filters.sourceType) {
    conditions.push(`d.source_type = $${paramIndex}`);
    values.push(filters.sourceType);
    paramIndex += 1;
  }

  values.push(limit);

  const result = await pool.query(`
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.chunk_index,
      c.embedding,
      c.metadata,
      d.name AS document_name,
      c.embedding <=> $1::vector AS distance
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.status = 'ready' AND ${conditions.join(" AND ")}
    ORDER BY c.embedding <=> $1::vector ASC
    LIMIT $${paramIndex}
  `, values);

  return result.rows;
}

function mergeCandidates(keywordRows, vectorRows) {
  const merged = new Map();

  for (const row of [...keywordRows, ...vectorRows]) {
    const existing = merged.get(row.id);
    merged.set(row.id, existing ? { ...existing, ...row } : row);
  }

  return Array.from(merged.values());
}

export async function retrieve({ query, topK = 5, retrievalMode = "hybrid", filters = {}, skipCache = false, userId = null }) {
  const start = process.hrtime.bigint();
  const key = cacheKey(query, retrievalMode, topK);

  if (!skipCache) {
    const cached = cacheGet(key);
    if (cached) {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      recordLatency("retrieval", elapsed);
      return { ...cached, fromCache: true };
    }
  }

  const queryTokens = tokenize(query);
  const keywordRows = await fetchCandidateRows({ query, filters, userId });
  let queryEmbedding = null;
  let vectorRows = [];
  let vectorError = null;

  if (retrievalMode === "vector" || retrievalMode === "hybrid") {
    try {
      queryEmbedding = await embed(query);
      vectorRows = await fetchVectorCandidateRows({ queryEmbedding, filters, userId });
    } catch (error) {
      vectorError = error.message;
    }
  }

  const candidateRows = mergeCandidates(keywordRows, vectorRows);
  const allChunks = candidateRows.map(decorateChunk);

  if (allChunks.length === 0) {
    const result = {
      results: [],
      debug: {
        queryTokens,
        totalChunks: 0,
        prefilterPassed: 0,
        prefilterUsed: false,
        vectorUsed: false,
        vectorError
      }
    };
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    recordLatency("retrieval", elapsed);
    return result;
  }

  if (queryTokens.length === 0) {
    const result = {
      results: allChunks.slice(0, topK).map((chunk) => ({ chunk, score: 0, displayScore: 0 })),
      debug: {
        queryTokens,
        totalChunks: allChunks.length,
        prefilterPassed: 0,
        prefilterUsed: false,
        vectorUsed: false,
        vectorError
      }
    };
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
    recordLatency("retrieval", elapsed);
    return result;
  }

  let candidates = keywordPrefilter(allChunks, queryTokens);
  const prefilterCount = candidates.length;
  if (candidates.length < topK) {
    candidates = allChunks;
  }

  const { idf, avgDocLen } = computeIDF(allChunks);

  const bm25Ranked = candidates
    .map((chunk) => ({ chunk, score: bm25Score(chunk, queryTokens, idf, avgDocLen) }))
    .sort((a, b) => b.score - a.score);

  const queryVector = tfidfVector(queryTokens, idf);
  const tfidfRanked = candidates
    .map((chunk) => ({
      chunk,
      score: cosineSim(queryVector, tfidfVector(chunk.tokens, idf))
    }))
    .sort((a, b) => b.score - a.score);

  const vectorScoreMap = new Map(
    vectorRows.map((row) => [
      row.id,
      Math.max(0, 1 - Number(row.distance))
    ])
  );

  const vectorRanked = candidates
    .filter((chunk) => vectorScoreMap.has(chunk.id))
    .map((chunk) => ({
      chunk,
      score: vectorScoreMap.get(chunk.id)
    }))
    .sort((a, b) => b.score - a.score);

  const vectorUsed = vectorRanked.length > 0;
  let fused;

  if (retrievalMode === "keyword") {
    fused = bm25Ranked;
  } else if (retrievalMode === "vector") {
    fused = vectorUsed ? vectorRanked : [];
  } else {
    fused = vectorUsed
      ? rrf3way(bm25Ranked, tfidfRanked, vectorRanked)
      : rrf2way(bm25Ranked, tfidfRanked);
  }

  const preMMR = fused.slice(0, Math.min(topK * 3, fused.length));
  const selected = mmrSelect(preMMR, topK);
  const maxScore = selected[0]?.score || 1;

  const results = selected.map((item) => ({
    chunk: {
      id: item.chunk.id,
      docId: item.chunk.docId,
      docName: item.chunk.docName,
      text: item.chunk.text,
      chunkIndex: item.chunk.chunkIndex,
      embedding: item.chunk.embedding,
      metadata: item.chunk.metadata
    },
    score: item.score,
    displayScore: item.score / maxScore
  }));

  const result = {
    results,
    debug: {
      queryTokens,
      totalChunks: allChunks.length,
      prefilterPassed: prefilterCount,
      prefilterUsed: prefilterCount >= topK,
      vectorUsed,
      vectorError,
      bm25Top: bm25Ranked.slice(0, 5).map((item) => ({
        id: item.chunk.id,
        docName: item.chunk.docName,
        score: item.score
      })),
      tfidfTop: tfidfRanked.slice(0, 5).map((item) => ({
        id: item.chunk.id,
        docName: item.chunk.docName,
        score: item.score
      })),
      vectorTop: vectorRanked.slice(0, 5).map((item) => ({
        id: item.chunk.id,
        docName: item.chunk.docName,
        score: item.score
      })),
      preMMRCount: preMMR.length
    }
  };

  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  recordLatency("retrieval", elapsed);
  cacheSet(key, result);
  return result;
}

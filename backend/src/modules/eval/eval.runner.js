import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/client.js";
import { retrieve } from "../retrieval/retrieval.service.js";
import { hitAtK, recallAtK, mrr, precisionAtK, ndcg } from "./metrics.js";

function normalizeExpectedChunks(value) {
  if (Array.isArray(value)) return value;
  return [];
}

export async function runEvaluation({ mode = "hybrid", topK = 5 }) {
  const datasetRes = await pool.query(`
    SELECT id, query, expected_chunks
    FROM eval_dataset
    ORDER BY id ASC
  `);

  const dataset = datasetRes.rows;
  let totalHit = 0;
  let totalRecall = 0;
  let totalMRR = 0;
  let totalPrecision = 0;
  let totalNDCG = 0;
  const details = [];

  for (const item of dataset) {
    const expectedChunks = normalizeExpectedChunks(item.expected_chunks);
    const retrieval = await retrieve({
      query: item.query,
      topK,
      retrievalMode: mode,
      skipCache: true
    });

    const retrievedIds = (retrieval.results || []).map((result) => result.chunk.id);
    const hit = hitAtK(retrievedIds, expectedChunks);
    const recall = recallAtK(retrievedIds, expectedChunks);
    const mrrScore = mrr(retrievedIds, expectedChunks);
    const precision = precisionAtK(retrievedIds, expectedChunks, topK);
    const ndcgScore = ndcg(retrievedIds, expectedChunks);

    totalHit += hit;
    totalRecall += recall;
    totalMRR += mrrScore;
    totalPrecision += precision;
    totalNDCG += ndcgScore;

    details.push({
      datasetId: item.id,
      query: item.query,
      retrievedIds,
      expected: expectedChunks,
      hit,
      recall,
      mrr: mrrScore,
      precisionAtK: precision,
      ndcg: ndcgScore,
      debug: retrieval.debug
    });
  }

  const n = dataset.length || 1;
  const summary = {
    totalQueries: dataset.length,
    mode,
    topK,
    hitAtK: totalHit / n,
    recallAtK: totalRecall / n,
    mrr: totalMRR / n,
    precisionAtK: totalPrecision / n,
    ndcg: totalNDCG / n
  };

  const payload = { summary, details };

  await pool.query(`
    INSERT INTO eval_runs (id, mode, top_k, results)
    VALUES ($1, $2, $3, $4::jsonb)
  `, [
    uuidv4(),
    mode,
    topK,
    JSON.stringify(payload)
  ]);

  return payload;
}

export async function getLatestEvaluation() {
  const result = await pool.query(`
    SELECT id, mode, top_k, results, created_at
    FROM eval_runs
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

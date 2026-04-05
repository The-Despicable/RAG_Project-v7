import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/client.js";
import { generateAnswer } from "../generation/generation.service.js";
import { retrieve } from "../retrieval/retrieval.service.js";
import {
  answerMatch,
  citationCoverage,
  refusalAccuracy,
  groundedness
} from "./generation.metrics.js";

function normalizeExpectedChunks(value) {
  return Array.isArray(value) ? value : [];
}

export async function runGenerationEvaluation() {
  const datasetRes = await pool.query(`
    SELECT id, query, expected_chunks, expected_answer, should_refuse
    FROM eval_dataset
    ORDER BY id ASC
  `);

  const dataset = datasetRes.rows;
  let totalMatch = 0;
  let totalCitation = 0;
  let totalRefusal = 0;
  let totalGrounded = 0;
  const details = [];

  for (const item of dataset) {
    const retrieval = await retrieve({
      query: item.query,
      topK: 5,
      retrievalMode: "hybrid"
    });
    const retrievalScores = (retrieval.results || []).map((result) => result.displayScore ?? result.score ?? 0);
    const retrievalAvg = retrievalScores.length > 0
      ? retrievalScores.reduce((sum, score) => sum + score, 0) / retrievalScores.length
      : 0;

    const generated = await generateAnswer({
      query: item.query,
      chunks: retrieval.results,
      apiKey: process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "",
      baseUrl: process.env.LLM_BASE_URL || "",
      model: process.env.LLM_MODEL || "",
      provider: process.env.LLM_PROVIDER || ""
    });

    const match = answerMatch(generated.answer, item.expected_answer);
    const citation = citationCoverage(generated.answer, generated.citations);
    const refusal = refusalAccuracy(generated.answer, Boolean(item.should_refuse));
    const grounded = await groundedness(generated.answer, retrieval.results);

    totalMatch += match;
    totalCitation += citation;
    totalRefusal += refusal;
    totalGrounded += grounded;

    details.push({
      datasetId: item.id,
      query: item.query,
      answer: generated.answer,
      expectedAnswer: item.expected_answer,
      expectedChunks: normalizeExpectedChunks(item.expected_chunks),
      citations: generated.citations,
      match,
      citationCoverage: citation,
      refusalAccuracy: refusal,
      groundedness: grounded,
      retrievalAvg
    });
  }

  const n = dataset.length || 1;
  const summary = {
    totalQueries: dataset.length,
    answerMatch: totalMatch / n,
    citationCoverage: totalCitation / n,
    refusalAccuracy: totalRefusal / n,
    groundedness: totalGrounded / n
  };

  const payload = { summary, details };

  await pool.query(`
    INSERT INTO generation_eval_runs (id, results)
    VALUES ($1, $2::jsonb)
  `, [
    uuidv4(),
    JSON.stringify(payload)
  ]);

  return payload;
}

export async function getLatestGenerationEvaluation() {
  const result = await pool.query(`
    SELECT id, results, created_at
    FROM generation_eval_runs
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

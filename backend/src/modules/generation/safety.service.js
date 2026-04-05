import { citationCoverage, groundedness } from "../eval/generation.metrics.js";
import { ACTIVE_CONFIG } from "./safety.config.js";

export function detectHallucination(groundedScore) {
  const { thresholds } = ACTIVE_CONFIG;

  if (groundedScore >= thresholds.strong) {
    return {
      flag: false,
      level: "low"
    };
  }

  if (groundedScore >= thresholds.moderate) {
    return {
      flag: false,
      level: "medium"
    };
  }

  if (groundedScore >= thresholds.weak) {
    return {
      flag: true,
      level: "high"
    };
  }

  return {
    flag: true,
    level: "critical"
  };
}

export function computeConfidence({ groundednessScore, retrievalScores, hasCitations }) {
  const { weights } = ACTIVE_CONFIG;
  const scores = Array.isArray(retrievalScores) ? retrievalScores.filter((score) => Number.isFinite(score)) : [];
  const avgRetrieval = scores.length > 0
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : 0;

  const confidence =
    (weights.groundedness * groundednessScore) +
    (weights.retrieval * avgRetrieval) +
    (weights.citations * (hasCitations ? 1 : 0));
  return Math.min(1, Math.max(0, confidence));
}

export async function evaluateGenerationSafety({ answer, chunks, citations }) {
  const groundednessScore = await groundedness(answer, chunks);
  const hallucination = detectHallucination(groundednessScore);
  const hasCitations = citationCoverage(answer, citations) === 1;
  const retrievalScores = (chunks || []).map((item) => item?.displayScore ?? item?.score ?? 0);
  const retrievalAvg = retrievalScores.length > 0
    ? retrievalScores.reduce((sum, score) => sum + score, 0) / retrievalScores.length
    : 0;
  const confidence = computeConfidence({
    groundednessScore,
    retrievalScores,
    hasCitations
  });

  return {
    confidence,
    hallucination,
    debug: {
      groundedness: groundednessScore,
      retrievalAvg,
      hasCitations,
      thresholds: ACTIVE_CONFIG.thresholds,
      weights: ACTIVE_CONFIG.weights,
      configVersion: ACTIVE_CONFIG.version
    }
  };
}

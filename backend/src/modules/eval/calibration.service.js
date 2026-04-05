import { evaluateConfig } from "./eval-config.js";
import { fitWeights } from "./fit-weights.js";
import { loadGenerationEvalData } from "./calibration.loader.js";
import { labelData } from "./label.js";
import { computeThresholds } from "./thresholds.js";

export async function calibrate(limit = 5) {
  const raw = await loadGenerationEvalData(limit);
  const data = labelData(raw);
  const thresholds = computeThresholds(data);
  const weights = fitWeights(data);
  const metrics = evaluateConfig(data, thresholds, weights);

  return {
    sampleSize: data.length,
    thresholds,
    weights,
    metrics
  };
}

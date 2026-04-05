export function evaluateConfig(data, thresholds, weights) {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const item of data) {
    const confidence =
      (weights.groundedness * (item.groundedness ?? 0)) +
      (weights.retrieval * (item.retrievalAvg ?? 0)) +
      (weights.citations * (item.citationCoverage ? 1 : 0));

    const isHallucination = (item.groundedness ?? 0) < thresholds.weak;
    const predictedGood = !isHallucination && confidence >= 0.5;
    const actualGood = item.label === 1;

    if (predictedGood && actualGood) tp += 1;
    if (predictedGood && !actualGood) fp += 1;
    if (!predictedGood && actualGood) fn += 1;
  }

  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  const f1 = (2 * precision * recall) / Math.max(1e-6, precision + recall);

  return { precision, recall, f1 };
}

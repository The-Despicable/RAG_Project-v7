const DEFAULT_THRESHOLDS = {
  strong: 0.85,
  moderate: 0.7,
  weak: 0.5
};

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(p * (sorted.length - 1));
  return sorted[index];
}

export function computeThresholds(data) {
  const good = data.filter((item) => item.label === 1).map((item) => item.groundedness ?? 0);
  const bad = data.filter((item) => item.label === 0).map((item) => item.groundedness ?? 0);

  if (good.length < 5 || bad.length < 5) {
    return DEFAULT_THRESHOLDS;
  }

  return {
    strong: percentile(good, 0.25),
    moderate: percentile(good, 0.10),
    weak: percentile(bad, 0.75)
  };
}

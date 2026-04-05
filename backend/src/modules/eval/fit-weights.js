function dot(weights, vector) {
  return (weights.g * vector.g) + (weights.r * vector.r) + (weights.c * vector.c);
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

export function fitWeights(data, iters = 200, lr = 0.05) {
  let weights = { g: 0.5, r: 0.3, c: 0.2 };

  for (let t = 0; t < iters; t += 1) {
    const grad = { g: 0, r: 0, c: 0 };

    for (const item of data) {
      const vector = {
        g: item.groundedness ?? 0,
        r: item.retrievalAvg ?? 0,
        c: item.citationCoverage ? 1 : 0
      };

      const y = item.label;
      const p = sigmoid(dot(weights, vector));
      const err = p - y;

      grad.g += err * vector.g;
      grad.r += err * vector.r;
      grad.c += err * vector.c;
    }

    const n = data.length || 1;
    weights.g -= lr * (grad.g / n);
    weights.r -= lr * (grad.r / n);
    weights.c -= lr * (grad.c / n);
  }

  const sum = Math.max(1e-6, Math.abs(weights.g) + Math.abs(weights.r) + Math.abs(weights.c));
  return {
    groundedness: Math.max(0, weights.g) / sum,
    retrieval: Math.max(0, weights.r) / sum,
    citations: Math.max(0, weights.c) / sum
  };
}

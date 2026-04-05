const operationMetrics = new Map();
const startTime = Date.now();
let totalRequests = 0;

function getOrCreate(operation) {
  if (!operationMetrics.has(operation)) {
    operationMetrics.set(operation, {
      min: Infinity,
      max: 0,
      sum: 0,
      count: 0,
      errors: 0
    });
  }
  return operationMetrics.get(operation);
}

export function recordLatency(operation, durationMs) {
  const m = getOrCreate(operation);
  if (durationMs < m.min) m.min = durationMs;
  if (durationMs > m.max) m.max = durationMs;
  m.sum += durationMs;
  m.count += 1;
}

export function recordError(operation) {
  const m = getOrCreate(operation);
  m.errors += 1;
}

export function incrementRequests() {
  totalRequests += 1;
}

export function getMetrics() {
  const metrics = {};
  for (const [operation, m] of operationMetrics) {
    metrics[operation] = {
      min: m.min === Infinity ? 0 : m.min,
      max: m.max,
      avg: m.count > 0 ? Math.round(m.sum / m.count) : 0,
      count: m.count,
      errors: m.errors
    };
  }
  return {
    uptimeMs: Date.now() - startTime,
    totalRequests,
    operations: metrics
  };
}

export function resetMetrics() {
  operationMetrics.clear();
  totalRequests = 0;
}

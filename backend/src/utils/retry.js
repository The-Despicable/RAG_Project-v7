export async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 500, maxDelayMs = 5000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
        console.warn(`Retry attempt ${attempt}/${maxAttempts} after ${delay}ms: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

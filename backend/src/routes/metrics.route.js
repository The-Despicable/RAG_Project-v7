import { getMetrics, resetMetrics } from "../utils/metrics.js";

export default async function metricsRoute(fastify) {
  fastify.get("/", async () => getMetrics());
  fastify.delete("/", async () => {
    resetMetrics();
    return { ok: true };
  });
}

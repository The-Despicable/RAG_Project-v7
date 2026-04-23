import { getMetrics, resetMetrics } from "../utils/metrics.js";
import { checkEnvVars } from "../server.js";

export default async function metricsRoute(fastify) {
  fastify.get("/", async () => getMetrics());
  fastify.delete("/", async () => {
    resetMetrics();
    return { ok: true };
  });
  fastify.get("/health", async () => {
    checkEnvVars();
    return { status: "healthy", timestamp: new Date().toISOString() };
  });
}

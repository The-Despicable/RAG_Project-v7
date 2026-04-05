import Fastify from "fastify";
import evalRoute from "./routes/eval.route.js";
import queryRoute from "./routes/query.route.js";
import ingestRoute from "./routes/ingest.route.js";
import metricsRoute from "./routes/metrics.route.js";
import { incrementRequests } from "./utils/metrics.js";

const app = Fastify({
  logger: true,
  connectionTimeout: 30000
});

app.addHook("onRequest", async (request) => {
  request.requestStartTime = process.hrtime.bigint();
});

app.addHook("onResponse", async (request, reply) => {
  incrementRequests();
  const elapsed = Number(process.hrtime.bigint() - request.requestStartTime) / 1e6;
  request.log.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    latencyMs: Math.round(elapsed)
  });
});

app.get("/health", async () => ({
  ok: true
}));

app.register(queryRoute, { prefix: "/query" });
app.register(ingestRoute, { prefix: "/ingest" });
app.register(evalRoute, { prefix: "/eval" });
app.register(metricsRoute, { prefix: "/metrics" });

export default app;

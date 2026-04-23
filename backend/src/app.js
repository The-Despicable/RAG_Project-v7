function sanitizeInput(str) {
  return typeof str === "string" ? str.replace(/[\x00]/g, "") : str;
}

function stripNullBytes(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stripNullBytes);
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === "string" ? sanitizeInput(v) : stripNullBytes(v)]));
}

import Fastify from "fastify";
import cors from "@fastify/cors";
import evalRoute from "./routes/eval.route.js";
import queryRoute from "./routes/query.route.js";
import ingestRoute from "./routes/ingest.route.js";
import metricsRoute from "./routes/metrics.route.js";
import { incrementRequests } from "./utils/metrics.js";

const app = Fastify({
  logger: true,
  connectionTimeout: 30000
});

// Register CORS plugin for cross-origin requests
app.register(cors, {
  origin: ["https://rag-v7.netlify.app", "http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-base-url", "x-model", "x-provider"],
  credentials: true
});

app.addHook("onRequest", async (request) => {
  request.body = stripNullBytes(request.body || {});
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

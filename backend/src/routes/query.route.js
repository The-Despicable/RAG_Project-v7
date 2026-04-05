import { v4 as uuidv4 } from "uuid";
import { generateAnswer } from "../modules/generation/generation.service.js";
import { evaluateGenerationSafety } from "../modules/generation/safety.service.js";
import { retrieve } from "../modules/retrieval/retrieval.service.js";
import { authenticate } from "../utils/auth.js";

const querySchema = {
  body: {
    type: "object",
    required: ["query"],
    additionalProperties: false,
    properties: {
      query: { type: "string", minLength: 1, maxLength: 5000 },
      topK: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      retrievalMode: {
        type: "string",
        enum: ["hybrid", "keyword", "vector"],
        default: "hybrid"
      },
      generation: { type: "boolean", default: false },
      filters: { type: "object", additionalProperties: true, default: {} },
      conversationId: { type: "string" }
    }
  }
};

export default async function queryRoute(fastify) {
  fastify.post("/", {
    preHandler: authenticate,
    schema: querySchema
  }, async (request, reply) => {
    const startedAt = Date.now();
    const {
      query,
      topK = 5,
      retrievalMode = "hybrid",
      generation = false,
      filters = {}
    } = request.body;

    const retrieval = await retrieve({
      query,
      topK,
      retrievalMode,
      filters,
      userId: request.userId
    });

    let answer = null;
    let citations = [];
    let provider = null;
    let model = null;
    let confidence = null;
    let hallucination = null;

    if (generation) {
      const generated = await generateAnswer({
        query,
        chunks: retrieval.results,
        apiKey: request.headers["x-api-key"] || process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || "",
        baseUrl: request.headers["x-base-url"] || process.env.LLM_BASE_URL || "",
        model: request.headers["x-model"] || process.env.LLM_MODEL || "",
        provider: request.headers["x-provider"] || process.env.LLM_PROVIDER || ""
      });
      answer = generated.answer;
      citations = generated.citations;
      provider = generated.provider;
      model = generated.model;

      const safety = await evaluateGenerationSafety({
        answer,
        chunks: retrieval.results,
        citations
      });

      confidence = safety.confidence;
      hallucination = safety.hallucination;

      if (hallucination.level === "critical") {
        answer = "Not found in provided documents.";
        citations = [];
        confidence = 0;
      }

      retrieval.debug = {
        ...retrieval.debug,
        generation: {
          ...safety.debug
        }
      };
    }

    const latency = Date.now() - startedAt;

    return reply.send({
      id: uuidv4(),
      mode: generation ? "rag" : "retrieval",
      latency,
      retrievalMode,
      answer,
      citations,
      confidence,
      hallucination,
      provider,
      model,
      results: retrieval.results,
      debug: retrieval.debug
    });
  });
}

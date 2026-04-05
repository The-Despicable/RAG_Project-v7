import {
  getLatestGenerationEvaluation,
  runGenerationEvaluation
} from "../modules/eval/generation.eval.runner.js";
import { calibrate } from "../modules/eval/calibration.service.js";
import { getLatestEvaluation, runEvaluation } from "../modules/eval/eval.runner.js";
import { authenticate } from "../utils/auth.js";

const evalSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: {
        type: "string",
        enum: ["keyword", "vector", "hybrid"],
        default: "hybrid"
      },
      topK: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        default: 5
      }
    }
  }
};

export default async function evalRoute(fastify) {
  fastify.post("/run", {
    preHandler: authenticate,
    schema: evalSchema
  }, async (request, reply) => {
    const {
      mode = "hybrid",
      topK = 5
    } = request.body || {};

    const result = await runEvaluation({ mode, topK });
    return reply.send(result);
  });

  fastify.get("/latest", {
    preHandler: authenticate
  }, async (_request, reply) => {
    const result = await getLatestEvaluation();
    return reply.send(result);
  });

  fastify.post("/generation", {
    preHandler: authenticate
  }, async (_request, reply) => {
    const result = await runGenerationEvaluation();
    return reply.send(result);
  });

  fastify.get("/generation/latest", {
    preHandler: authenticate
  }, async (_request, reply) => {
    const result = await getLatestGenerationEvaluation();
    return reply.send(result);
  });

  fastify.post("/calibrate", {
    preHandler: authenticate
  }, async (_request, reply) => {
    const result = await calibrate();
    return reply.send(result);
  });
}

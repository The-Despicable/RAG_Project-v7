import { createIngestJob, getIngestJob } from "../modules/ingest/ingest.service.js";
import { authenticate } from "../utils/auth.js";

const ingestBodySchema = {
  type: "object",
  required: ["sourceType", "content"],
  additionalProperties: false,
  properties: {
    sourceType: {
      type: "string",
      enum: ["file", "url", "text"]
    },
    content: { type: "string" },
    metadata: { type: "object", additionalProperties: true, default: {} },
    name: { type: "string" },
    sourceUri: { type: "string" }
  }
};

export default async function ingestRoute(fastify) {
  fastify.post("/", {
    preHandler: authenticate,
    schema: {
      body: ingestBodySchema
    }
  }, async (request, reply) => {
    const job = await createIngestJob(request.body, request.userId);
    return reply.code(202).send(job);
  });

  fastify.get("/:jobId", {
    preHandler: authenticate,
    schema: {
      params: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string", minLength: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const job = await getIngestJob(request.params.jobId);
    if (!job) {
      return reply.code(404).send({
        error: "Ingest job not found."
      });
    }

    return reply.send({
      jobId: job.id,
      documentId: job.document_id,
      status: job.status,
      progress: job.progress,
      error: job.error || null
    });
  });
}

import { randomUUID } from "node:crypto";
import { pool, query } from "../../db/client.js";
import { embed, formatVectorLiteral } from "../../utils/embed.js";
import { chunkText } from "./chunking.js";

const EMBED_CONCURRENCY = 3;

function normalizePayload(input = {}) {
  const sourceType = input.sourceType;
  const content = String(input.content || "").trim();
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const sourceUri = input.sourceUri || null;
  const name = input.name?.trim() || defaultDocumentName(sourceType, sourceUri);

  return {
    sourceType,
    content,
    metadata,
    sourceUri,
    name
  };
}

function defaultDocumentName(sourceType, sourceUri) {
  if (sourceType === "url" && sourceUri) return sourceUri;
  if (sourceType === "file" && sourceUri) return sourceUri.split(/[\\/]/).pop();
  return `${sourceType || "document"}-${Date.now()}`;
}

async function updateJob(jobId, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = $${i}`);
    values.push(value);
    i += 1;
  }

  if (sets.length === 0) return;
  values.push(jobId);
  await pool.query(`UPDATE ingest_jobs SET ${sets.join(", ")} WHERE id = $${i}`, values);
}

async function embedChunkBatch(chunks) {
  const results = new Array(chunks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < chunks.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await embed(chunks[current].content);
    }
  }

  const workers = Array.from(
    { length: Math.min(EMBED_CONCURRENCY, chunks.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

async function replaceDocumentChunks(client, documentId, chunks, embeddings, metadata) {
  await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);
  if (chunks.length === 0) return;

  const values = [];
  const rows = [];
  let paramIndex = 1;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const embedding = formatVectorLiteral(embeddings[i]);
    rows.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}::vector, to_tsvector('simple', $${paramIndex + 2}), $${paramIndex + 6}::jsonb)`);
    values.push(
      randomUUID(),
      documentId,
      chunk.content,
      chunk.chunk_index,
      chunk.token_count,
      embedding,
      JSON.stringify({ ...metadata, chunkIndex: chunk.chunk_index })
    );
    paramIndex += 7;
  }

  await client.query(`
    INSERT INTO chunks (
      id,
      document_id,
      content,
      chunk_index,
      token_count,
      embedding,
      content_tsvector,
      metadata
    )
    VALUES ${rows.join(", ")}
  `, values);
}

export async function createIngestJob(input, userId = null) {
  const payload = normalizePayload(input);
  if (!payload.sourceType) {
    throw new Error("sourceType is required.");
  }
  if (!payload.content) {
    throw new Error("content is required for ingestion.");
  }

  const documentMetadata = { ...payload.metadata };
  if (userId) {
    documentMetadata.userId = userId;
  }

  const jobId = randomUUID();
  const documentId = randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO documents (id, name, source_type, source_uri, status, metadata)
      VALUES ($1, $2, $3, $4, 'processing', $5::jsonb)
    `, [
      documentId,
      payload.name,
      payload.sourceType,
      payload.sourceUri,
      JSON.stringify(documentMetadata)
    ]);

    await client.query(`
      INSERT INTO ingest_jobs (id, document_id, status, progress, payload, error)
      VALUES ($1, $2, 'queued', 0, $3::jsonb, NULL)
    `, [
      jobId,
      documentId,
      JSON.stringify({ ...payload, userId })
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    jobId,
    documentId,
    status: "queued"
  };
}

export async function getIngestJob(jobId) {
  const result = await pool.query(`
    SELECT id, document_id, status, progress, error, created_at, updated_at
    FROM ingest_jobs
    WHERE id = $1
  `, [jobId]);

  return result.rows[0] || null;
}

export async function claimNextQueuedJob() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      WITH next_job AS (
        SELECT id
        FROM ingest_jobs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE ingest_jobs j
      SET status = 'processing', progress = 5, error = NULL
      FROM next_job
      WHERE j.id = next_job.id
      RETURNING j.id, j.document_id, j.payload
    `);
    await client.query("COMMIT");
    return result.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processIngestJob(job) {
  const payload = job.payload || {};
  const userId = payload.userId || null;
  const chunks = chunkText(payload.content, payload.metadata || {});

  await updateJob(job.id, { progress: 20 });

  if (chunks.length === 0) {
    throw new Error("No chunks were produced from the provided content.");
  }

  const embeddings = await embedChunkBatch(chunks);
  await updateJob(job.id, { progress: 75 });

  const chunkMetadata = { ...payload.metadata };
  if (userId) {
    chunkMetadata.userId = userId;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await replaceDocumentChunks(client, job.document_id, chunks, embeddings, chunkMetadata);
    await client.query(`
      UPDATE documents
      SET status = 'ready'
      WHERE id = $1
    `, [job.document_id]);
    await client.query(`
      UPDATE ingest_jobs
      SET status = 'done', progress = 100, error = NULL
      WHERE id = $1
    `, [job.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function failIngestJob(job, error) {
  await Promise.all([
    updateJob(job.id, {
      status: "failed",
      progress: 100,
      error: error.message
    }),
    pool.query(`
      UPDATE documents
      SET status = 'failed'
      WHERE id = $1
    `, [job.document_id])
  ]);
}

export async function resetStuckJobs() {
  const result = await query(`
    UPDATE ingest_jobs
    SET status = 'queued', progress = 0, error = NULL, updated_at = NOW()
    WHERE status = 'processing'
    RETURNING id
  `);
  return result.rowCount;
}

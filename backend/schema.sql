CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  name TEXT,
  source_type TEXT,
  source_uri TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at
  ON documents(created_at DESC);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INT NOT NULL,
  token_count INT,
  embedding VECTOR(384),
  content_tsvector TSVECTOR,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc_chunk
  ON chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_chunks_tsvector
  ON chunks USING GIN(content_tsvector);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  top_k INT NOT NULL,
  retrieval_mode TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  prompt_version TEXT,
  latency INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eval_dataset (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  expected_chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_answer TEXT,
  should_refuse BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id UUID PRIMARY KEY,
  mode TEXT NOT NULL,
  top_k INT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eval_runs_created_at
  ON eval_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS generation_eval_runs (
  id UUID PRIMARY KEY,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_eval_runs_created_at
  ON generation_eval_runs(created_at DESC);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chunks_updated_at ON chunks;
CREATE TRIGGER trg_chunks_updated_at
BEFORE UPDATE ON chunks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_ingest_jobs_updated_at ON ingest_jobs;
CREATE TRIGGER trg_ingest_jobs_updated_at
BEFORE UPDATE ON ingest_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

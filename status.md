# RAG Project V7 Status

## Current Status

- Project folder: `C:\Users\yaser\Desktop\RAG_PROJECT_V7`
- Current phase: `Phase 8.6`
- Completed phases: `8`
- In-progress phase level: `8.6`
- System maturity: `production-grade RAG engine`, not yet full production product

## Phase Summary

1. Backend architecture and modular monolith plan
2. Fastify backend scaffold and PostgreSQL schema
3. Deterministic retrieval backend
4. Hybrid retrieval with pgvector and 3-way fusion
5. Ingestion worker and automated indexing
6. Backend generation layer with citations
7. Retrieval evaluation harness
8. Baseline generation evaluation
8.5. Embedding-based groundedness for generation eval
8.6. Auto-calibration and versioned safety rollout

## What Is Implemented

### Frontend

- Adaptive multi-provider cloud selection in `rag_project_v6_2.html`
- Auto provider detection
- Dynamic model discovery with fallback model handling
- Shared resolver path for test connection and live cloud requests

### Backend Core

- Fastify API with:
  - `/query`
  - `/ingest`
  - `/eval/run`
  - `/eval/latest`
  - `/eval/generation`
  - `/eval/generation/latest`
- PostgreSQL schema with:
  - `documents`
  - `chunks`
  - `ingest_jobs`
  - `queries`
  - `eval_dataset`
  - `eval_runs`
  - `generation_eval_runs`
- Worker-based ingestion pipeline
- Backend chunking and embedding generation
- Retrieval restricted to `documents.status = 'ready'`

### Retrieval

- BM25
- TF-IDF
- Vector similarity with pgvector
- RRF fusion
- MMR reranking
- Deterministic retrieval mode
- Hybrid retrieval mode

### Generation

- Backend-only generation path
- Grounded prompt builder
- Citation extraction and mapping
- No-context fallback:
  - `Not found in provided documents.`
- Provider/model resolution on backend

### Evaluation

- Retrieval metrics:
  - `Hit@K`
  - `Recall@K`
  - `MRR`
  - `Precision@K`
  - `NDCG`
- Generation metrics:
  - `answerMatch`
  - `citationCoverage`
  - `refusalAccuracy`
  - `groundedness`
- Groundedness upgraded from token overlap to embedding similarity
- Auto-calibration endpoint:
  - `/eval/calibrate`
- Versioned safety configs:
  - `SAFETY_CONFIG_V1`
  - `SAFETY_CONFIG_V2`
  - `ACTIVE_CONFIG`

## Key Findings

- The system is roughly `75% to 85%` toward a full production-ready product.
- The RAG engine itself is strong and complete enough for interview/demo use.
- Remaining work is mostly hardening and product infrastructure, not core AI architecture.
- Retrieval and generation evaluation must stay separate to preserve signal quality.
- Embedding dimension consistency matters:
  - schema and embedding API are now aligned to `384`
- Retrieval should only expose fully indexed documents:
  - `documents.status = 'ready'`
- Browser-direct provider access is useful for demos, but backend-controlled model calls are more stable for real usage.

## Major Changes Logged

### Structural Changes

- Created backend project under `backend/`
- Moved all project assets into `C:\Users\yaser\Desktop\RAG_PROJECT_V7`
- Added worker entrypoint and backend modules for retrieval, ingest, generation, and eval

### Backend Changes

- Added ingestion worker loop and job processing
- Added chunk insertion with embeddings and `tsvector`
- Added generation service and provider-aware LLM client
- Added retrieval evaluation runner and storage
- Added generation evaluation runner and storage
- Added semantic groundedness using stored chunk embeddings plus answer embedding
- Added calibration loader, threshold fitting, confidence weight fitting, and config evaluation
- Added versioned safety config with debug visibility for active thresholds and weights

### Frontend Changes

- Upgraded static provider UI into adaptive provider flow
- Added auto-detection and dynamic model selection behavior
- Added provider fallback handling and status display

## Current Risks / Remaining Gaps

- Reliability hardening is not complete:
  - retry logic
  - timeout handling
  - stronger crash recovery
- Multi-user isolation is not implemented:
  - auth
  - document ownership
  - per-user filtering
- Performance hardening is not complete:
  - ANN index tuning
  - caching
  - streaming
- Observability is still limited:
  - structured logs
  - latency metrics
  - cost tracking
- Runtime setup is not complete on this machine yet:
  - `backend/node_modules` is not installed
  - no active `DATABASE_URL` environment variable was available
  - no active `LLM_API_KEY` or `OPENROUTER_API_KEY` environment variable was available

## Session Resume Log

### Latest Completed Work

- Added generation safety layer:
  - threshold-based hallucination flag
  - confidence scoring
  - critical-answer guardrail
- Upgraded generation eval groundedness to embedding similarity
- Added calibration pipeline:
  - recent run loader
  - label generation
  - threshold suggestion
  - confidence-weight fitting
  - calibration metrics
- Added versioned rollout control:
  - `SAFETY_CONFIG_V1`
  - `SAFETY_CONFIG_V2`
  - `ACTIVE_CONFIG = SAFETY_CONFIG_V1`

### Current Rollout State

- Active config remains baseline:
  - `ACTIVE_CONFIG = SAFETY_CONFIG_V1`
- Calibrated config support exists but has not been promoted.

### Blockers Before Calibration Run

- Install backend dependencies in `backend/`
- Configure database connection
- Configure generation provider key/model
- Ensure `generation_eval_runs` has enough data before trusting `/eval/calibrate`

### Resume Commands

From `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend`:

1. `npm install`
2. apply `schema.sql` to the target database
3. set env vars:
   - `DATABASE_URL`
   - `LLM_API_KEY` or `OPENROUTER_API_KEY`
   - optional `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`
4. run API:
   - `node src/server.js`
5. run worker:
   - `node worker.js`
6. build generation eval data:
   - `POST /eval/generation`
7. run calibration:
   - `POST /eval/calibrate`
8. review output against acceptance criteria before changing `ACTIVE_CONFIG`

## Recommended Next Phases

### Phase 9

- Reliability and production hardening
- Retry wrappers
- Timeouts
- worker recovery safeguards

### Phase 10

- Performance and observability
- pgvector ANN indexing
- caching
- request metrics
- structured logs

### Phase 11

- Product layer
- auth
- multi-user document isolation
- deployment polish

## Important Paths

- Frontend: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\rag_project_v6_2.html`
- Backend root: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend`
- Schema: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend\schema.sql`
- Worker: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend\worker.js`

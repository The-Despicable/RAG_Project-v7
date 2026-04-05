# RAG Project V7 Status

## Current Status

- Project folder: `C:\Users\yaser\Desktop\RAG_PROJECT_V7`
- Current phase: `Phase 11`
- Completed phases: `8, 8.5, 8.6, 11`
- In-progress phase level: `11`
- System maturity: `production-grade RAG engine with auth and multi-user isolation`

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
11. Product layer — auth, multi-user document isolation, frontend integration

## What Is Implemented

### Frontend

- Adaptive multi-provider cloud selection in `rag_project_v6_2.html`
- Auto provider detection
- Dynamic model discovery with fallback model handling
- Shared resolver path for test connection and live cloud requests
- API key input field (pre-filled with `key-user1`)
- Auth header injection on all backend fetch calls
- 401 auth error handling with user-facing message
- Backend query integration: `sendQuery()` calls `POST /query` with auth, falls back to local retrieval + direct LLM if backend unavailable
- Document ingestion now also sends to `POST /ingest` with auth headers
- Ollama default URL corrected to `http://localhost:11435`

### Backend Core

- Fastify API with:
  - `/query` (auth required)
  - `/ingest` (auth required)
  - `/eval/run` (auth required)
  - `/eval/latest` (auth required)
  - `/eval/generation` (auth required)
  - `/eval/generation/latest` (auth required)
  - `/eval/calibrate` (auth required)
  - `/health` (public)
  - `/metrics` (public)
- PostgreSQL schema with:
  - `documents`
  - `chunks`
  - `ingest_jobs`
  - `queries`
  - `eval_dataset`
  - `eval_runs`
  - `generation_eval_runs`
  - HNSW index on `chunks.embedding`
- Worker-based ingestion pipeline
- Backend chunking and embedding generation
- Retrieval restricted to `documents.status = 'ready'`

### Auth & Multi-User Isolation (Phase 11)

- API key authentication via `RAG_API_KEYS` env var (comma-separated)
- `Authorization: Bearer <key>` header extraction
- Key doubles as `userId` for document ownership
- `src/utils/auth.js` — Fastify preHandler hook
- Ingest routes store `userId` in `documents.metadata` and `ingest_jobs.payload`
- Query routes pass `userId` to retrieval for user-scoped filtering
- Eval routes protected with auth
- Retrieval service filters all DB queries by `documents.metadata->>'userId' = $userId`
- `/health` and `/metrics` remain public

### Retrieval

- BM25
- TF-IDF
- Vector similarity with pgvector
- RRF fusion
- MMR reranking
- Deterministic retrieval mode
- Hybrid retrieval mode
- User-scoped retrieval (Phase 11)

### Generation

- Backend-only generation path
- Grounded prompt builder
- Citation extraction and mapping
- No-context fallback:
  - `Not found in provided documents.`
- Provider/model resolution on backend
- Frontend calls backend `/query` with auth, falls back to direct Ollama/cloud

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

- The system is roughly `85% to 90%` toward a full production-ready product.
- The RAG engine itself is strong and complete enough for interview/demo use.
- Remaining work is mostly hardening and product infrastructure, not core AI architecture.
- Retrieval and generation evaluation must stay separate to preserve signal quality.
- Embedding dimension consistency matters:
  - schema and embedding API are now aligned to `384`
- Retrieval should only expose fully indexed documents:
  - `documents.status = 'ready'`
- Browser-direct provider access is useful for demos, but backend-controlled model calls are more stable for real usage.
- Frontend does not call backend for retrieval — it does local BM25/TF-IDF/embedding retrieval. Backend `/query` is called for RAG with generation.

## Major Changes Logged

### Structural Changes

- Created backend project under `backend/`
- Moved all project assets into `C:\Users\yaser\Desktop\RAG_PROJECT_V7`
- Added worker entrypoint and backend modules for retrieval, ingest, generation, and eval
- Initialized git repo with `.gitignore` for `node_modules/` and `.env`

### Backend Changes

- Added ingestion worker loop and job processing
- Added chunk insertion with embeddings and `tsvector`
- Added generation service and provider-aware LLM client
- Added retrieval evaluation runner and storage
- Added generation evaluation runner and storage
- Added semantic groundedness using stored chunk embeddings plus answer embedding
- Added calibration loader, threshold fitting, confidence weight fitting, and config evaluation
- Added versioned safety config with debug visibility for active thresholds and weights
- **Phase 11**: Added `src/utils/auth.js` API key authentication middleware
- **Phase 11**: Added `userId` to ingest jobs and document metadata
- **Phase 11**: Added `userId` filtering to all retrieval queries
- **Phase 11**: Added auth preHandler to ingest, query, and eval routes
- **Phase 11**: Added `RAG_API_KEYS` to `.env` and `.env.example`
- **Phase 11**: HNSW index defined in `schema.sql`

### Frontend Changes

- Upgraded static provider UI into adaptive provider flow
- Added auto-detection and dynamic model selection behavior
- Added provider fallback handling and status display
- Added API key input field with `getAuthHeaders()` and `handleAuthError()` helpers
- Wired `sendQuery()` to call backend `/query` with auth, with local fallback
- Wired `addDoc()` to also POST to backend `/ingest` with auth
- Fixed Ollama default URL from `11434` to `11435`
- Fixed orphaned code block that broke JavaScript syntax

## Current Risks / Remaining Gaps

- Reliability hardening is not complete:
  - retry logic
  - timeout handling
  - stronger crash recovery
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
- **Phase 11**: Full auth + multi-user document isolation implemented
- **Phase 11**: Frontend auth integration with API key input and error handling
- **Phase 11**: Backend query endpoint wired to frontend with auth headers
- **Phase 11**: Document ingestion now sends to backend with auth
- **Phase 11**: Ollama URL fixed to port 11435
- **Phase 11**: Git repo initialized, `.gitignore` files created
- **Phase 11**: Orphaned JavaScript code block fixed

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
   - `RAG_API_KEYS=key-user1,key-user2`
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

## Important Paths

- Frontend: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\rag_project_v6_2.html`
- Backend root: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend`
- Schema: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend\schema.sql`
- Worker: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend\worker.js`
- Auth middleware: `C:\Users\yaser\Desktop\RAG_PROJECT_V7\backend\src\utils\auth.js`

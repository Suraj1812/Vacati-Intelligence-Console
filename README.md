# Vacati Intelligence Console

Vacati Intelligence Console is a premium AI knowledge platform for hospitality teams: grounded chat, document ingestion, explainability, citations, provider-agnostic model orchestration, and production deployment support.

It is intentionally not a Gemini-only project. Gemini and Vertex AI are supported adapters, but the platform also supports Ollama, OpenRouter, vLLM, LM Studio, OpenAI-compatible APIs, native local embeddings, self-managed extractive generation, and pgvector.

## Product Surface

- AI chat with streamed general answers and source-backed answers when documents match
- PDF, DOCX, markdown, and text ingestion
- RAG retrieval with hybrid semantic and lexical reranking
- Citations and source attribution
- Explainability under every answer
- Knowledge sidebar with active sources, indexed chunks, retrieval hits, and embedding status
- AI system status page at `/status`
- Health endpoint at `/api/health`
- Premium dark UI built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, and Framer Motion

## Architecture

- `src/app/api/chat` streams grounded answers as server-sent events
- `src/app/api/knowledge` ingests files, chunks documents, embeds content, and updates the vector index
- `src/lib/ai/providers` contains provider adapters for Gemini, Vertex, Ollama, OpenRouter, vLLM, LM Studio, and OpenAI-compatible APIs
- `src/lib/ai/rag-pipeline.ts` orchestrates dynamic retrieval, generation, caching, observability, citations, and explainability
- `src/lib/ai/vector-store.ts` supports in-memory local mode and pgvector
- `src/hooks` contains client-safe state and streaming hooks
- `src/lib/config/env.ts` validates runtime configuration with Zod

See [Architecture](docs/ARCHITECTURE.md) and [Deployment](docs/DEPLOYMENT.md).

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The default mode is local and private: no external AI key is required. For general answers before documents are uploaded, connect Gemini, OpenRouter, Ollama, vLLM, LM Studio, or an OpenAI-compatible endpoint.

## Local AI With Ollama

```bash
npm run docker:up
docker exec -it vacati-ollama ollama pull llama3.1:8b
docker exec -it vacati-ollama ollama pull nomic-embed-text
```

Set:

```bash
AI_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

## OpenAI-Compatible Local Inference

For LM Studio:

```bash
AI_PROVIDER=lmstudio
LOCAL_LLM_BASE_URL=http://localhost:1234/v1
LOCAL_LLM_MODEL=local-model
```

For vLLM:

```bash
AI_PROVIDER=vllm
LOCAL_LLM_BASE_URL=http://localhost:8000/v1
LOCAL_LLM_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

For a generic OpenAI-compatible provider:

```bash
AI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example.com/v1
OPENAI_COMPATIBLE_API_KEY=...
OPENAI_COMPATIBLE_MODEL=...
```

## Cloud Providers

Gemini:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Vertex AI:

```bash
AI_PROVIDER=vertex
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=us-central1
GEMINI_MODEL=gemini-2.5-flash
```

OpenRouter:

```bash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct
```

## pgvector / Supabase

For production vector storage:

```bash
VECTOR_STORE=pgvector
DATABASE_URL=postgresql://...
EMBEDDING_DIMENSIONS=384
```

Run `supabase/migrations/001_pgvector_knowledge.sql` in Supabase SQL editor or through your migration workflow.

## Railway pgvector

For Railway, deploy the pgvector Postgres template, not the plain Postgres database, then add these variables to the app service:

```bash
VECTOR_STORE=pgvector
DATABASE_URL=${{Postgres.DATABASE_URL}}
EMBEDDING_PROVIDER=local
EMBEDDING_DIMENSIONS=384
MAX_UPLOAD_MB=25
```

Run `railway/migrations/001_pgvector_knowledge.sql` against the pgvector database. The app also creates the same tables lazily on first upload, but running the migration gives you a clean database view immediately.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
npm run check
```

## Deployment

The repo includes:

- `vercel.json`
- GitHub Actions CI
- GitHub Actions Vercel production workflow
- `Dockerfile`
- `docker-compose.yml`
- Supabase pgvector migration

Configure Vercel secrets and environment variables before enabling production deployment.

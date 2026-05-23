# Deployment

## Vercel

1. Create a Vercel project from the GitHub repository.
2. Add environment variables from `.env.example`.
3. Set production secrets:

```bash
AI_PROVIDER=vllm
LOCAL_LLM_BASE_URL=https://your-vllm-endpoint.example.com/v1
LOCAL_LLM_MODEL=meta-llama/Llama-3.1-8B-Instruct
VECTOR_STORE=pgvector
DATABASE_URL=...
EMBEDDING_PROVIDER=local
EMBEDDING_DIMENSIONS=384
```

4. Connect Supabase and run `supabase/migrations/001_pgvector_knowledge.sql`.
5. Deploy through Vercel Git integration or the included GitHub Actions workflow.

## Railway

1. Create a Railway project from the GitHub repository.
2. Add a pgvector Postgres database from the template marketplace. The standard Postgres image does not include pgvector.
3. Add these variables to the Next.js service:

```bash
VECTOR_STORE=pgvector
DATABASE_URL=${{Postgres.DATABASE_URL}}
EMBEDDING_PROVIDER=local
EMBEDDING_DIMENSIONS=384
MAX_UPLOAD_MB=25
```

4. Run `railway/migrations/001_pgvector_knowledge.sql` against the database, or let the app create the schema on first upload.
5. Deploy the service after the database variables are attached.

## GitHub Actions

The CI workflow runs:

```bash
npm ci
npm run lint
npm run typecheck
npm run build
```

The Vercel workflow requires these GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Docker

Build the app image:

```bash
docker build -t vacati-intelligence-console .
```

Run local infrastructure:

```bash
npm run docker:up
```

Local Postgres URL:

```bash
DATABASE_URL=postgresql://vacati:vacati@localhost:5432/vacati
VECTOR_STORE=pgvector
```

## Health Checks

Use:

```bash
curl http://localhost:3000/api/health
```

The endpoint returns provider, vector database, timestamp, and service health.

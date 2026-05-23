import type { KnowledgeChunk, KnowledgeDocument, RetrievalHit } from "@/lib/ai/types";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export interface VectorStore {
  addDocument(document: KnowledgeDocument, chunks: KnowledgeChunk[]): Promise<void>;
  similaritySearch(embedding: number[], limit: number): Promise<RetrievalHit[]>;
  hybridSearch(query: string, embedding: number[], limit: number): Promise<RetrievalHit[]>;
  listDocuments(): Promise<KnowledgeDocument[]>;
  countChunks(): Promise<number>;
  hasContent(): Promise<boolean>;
  provider(): "pgvector" | "In-memory";
}

export class InMemoryVectorStore implements VectorStore {
  private documents = new Map<string, KnowledgeDocument>();
  private chunks = new Map<string, KnowledgeChunk>();

  async addDocument(document: KnowledgeDocument, chunks: KnowledgeChunk[]) {
    this.documents.set(document.id, document);
    chunks.forEach((chunk) => this.chunks.set(chunk.id, chunk));
  }

  async similaritySearch(embedding: number[], limit: number) {
    return Array.from(this.chunks.values())
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(embedding, chunk.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ chunk, score }) => chunkToHit(chunk, score, "vector"));
  }

  async hybridSearch(query: string, embedding: number[], limit: number) {
    const tokens = tokenize(query);
    return Array.from(this.chunks.values())
      .map((chunk) => {
        const vectorScore = cosineSimilarity(embedding, chunk.embedding);
        const keywordScore = keywordSimilarity(tokens, chunk);
        const score = Math.min(1, vectorScore * 0.58 + keywordScore * 0.42);
        const matchType = keywordScore > 0.12 && vectorScore > 0.12 ? "hybrid" : keywordScore > vectorScore ? "keyword" : "vector";
        return chunkToHit(chunk, score, matchType);
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async listDocuments() {
    return Array.from(this.documents.values()).sort((left, right) =>
      right.uploadedAt.localeCompare(left.uploadedAt),
    );
  }

  async countChunks() {
    return this.chunks.size;
  }

  async hasContent() {
    return this.chunks.size > 0;
  }

  provider(): "pgvector" | "In-memory" {
    return "In-memory";
  }
}

export class PgVectorStore implements VectorStore {
  private poolPromise: Promise<import("pg").Pool> | null = null;
  private initialized = false;

  async addDocument(document: KnowledgeDocument, chunks: KnowledgeChunk[]) {
    const pool = await this.getPool();
    await this.ensureSchema();
    const client = await pool.connect();

    try {
      await client.query("begin");
      await client.query(
        `insert into knowledge_documents (
          id,
          name,
          type,
          status,
          uploaded_at,
          chunk_count,
          token_estimate,
          summary,
          tags
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        on conflict (id) do update set
          name = excluded.name,
          type = excluded.type,
          status = excluded.status,
          uploaded_at = excluded.uploaded_at,
          chunk_count = excluded.chunk_count,
          token_estimate = excluded.token_estimate,
          summary = excluded.summary,
          tags = excluded.tags`,
        [
          document.id,
          document.name,
          document.type,
          document.status,
          document.uploadedAt,
          document.chunkCount,
          document.tokenEstimate,
          document.summary,
          JSON.stringify(document.tags),
        ],
      );

      for (const chunk of chunks) {
        await client.query(
          `insert into knowledge_chunks (
            id,
            document_id,
            document_name,
            chunk_index,
            content,
            token_estimate,
            embedding,
            metadata
          ) values ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb)
          on conflict (id) do update set
            document_id = excluded.document_id,
            document_name = excluded.document_name,
            chunk_index = excluded.chunk_index,
            content = excluded.content,
            token_estimate = excluded.token_estimate,
            embedding = excluded.embedding,
            metadata = excluded.metadata`,
          [
            chunk.id,
            chunk.documentId,
            chunk.documentName,
            chunk.index,
            chunk.content,
            chunk.tokenEstimate,
            vectorLiteral(chunk.embedding),
            JSON.stringify(chunk.metadata),
          ],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw formatDatabaseError(error);
    } finally {
      client.release();
    }
  }

  async similaritySearch(embedding: number[], limit: number) {
    const pool = await this.getPool();
    await this.ensureSchema();

    const result = await pool.query<{
      id: string;
      document_id: string;
      document_name: string;
      content: string;
      distance: number;
      metadata: unknown;
    }>(
      `select
        id,
        document_id,
        document_name,
        content,
        embedding <=> $1::vector as distance,
        metadata
      from knowledge_chunks
      order by embedding <=> $1::vector
      limit $2`,
      [vectorLiteral(embedding), limit],
    );

    return result.rows.map((row) => {
      return rowToHit(row, Math.max(0, 1 - Number(row.distance)), "vector");
    });
  }

  async hybridSearch(query: string, embedding: number[], limit: number) {
    const pool = await this.getPool();
    await this.ensureSchema();
    const candidateLimit = Math.max(limit * 3, 24);
    const vectorResult = await pool.query<ChunkRow>(
      `select
        id,
        document_id,
        document_name,
        content,
        embedding <=> $1::vector as distance,
        metadata
      from knowledge_chunks
      order by embedding <=> $1::vector
      limit $2`,
      [vectorLiteral(embedding), candidateLimit],
    );
    const keywordResult = await pool.query<ChunkRow & { rank: number }>(
      `with q as (select websearch_to_tsquery('english', $1) as query)
      select
        id,
        document_id,
        document_name,
        content,
        1 as distance,
        metadata,
        ts_rank_cd(
          to_tsvector('english', document_name || ' ' || coalesce(metadata->>'section', '') || ' ' || content),
          q.query
        ) as rank
      from knowledge_chunks, q
      where q.query @@ to_tsvector('english', document_name || ' ' || coalesce(metadata->>'section', '') || ' ' || content)
      order by rank desc
      limit $2`,
      [query, candidateLimit],
    );

    const merged = new Map<string, RetrievalHit>();
    for (const row of vectorResult.rows) {
      merged.set(row.id, rowToHit(row, Math.max(0, 1 - Number(row.distance)), "vector"));
    }

    const maxRank = Math.max(...keywordResult.rows.map((row) => Number(row.rank)), 0.0001);
    for (const row of keywordResult.rows) {
      const keywordScore = Math.min(1, Number(row.rank) / maxRank);
      const existing = merged.get(row.id);
      if (existing) {
        existing.score = Math.min(1, existing.score * 0.58 + keywordScore * 0.42);
        existing.matchType = "hybrid";
        existing.confidence = confidenceForScore(existing.score);
      } else {
        merged.set(row.id, rowToHit(row, keywordScore, "keyword"));
      }
    }

    return Array.from(merged.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  async listDocuments() {
    const pool = await this.getPool();
    await this.ensureSchema();
    const result = await pool.query<{
      id: string;
      name: string;
      type: KnowledgeDocument["type"];
      status: KnowledgeDocument["status"];
      uploaded_at: Date | string;
      chunk_count: number;
      token_estimate: number;
      summary: string;
      tags: unknown;
    }>(`
      select
        id,
        name,
        type,
        status,
        uploaded_at,
        chunk_count,
        token_estimate,
        summary,
        tags
      from knowledge_documents
      order by uploaded_at desc
    `);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      uploadedAt:
        row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : new Date(row.uploaded_at).toISOString(),
      chunkCount: Number(row.chunk_count),
      tokenEstimate: Number(row.token_estimate),
      summary: row.summary,
      tags: normalizeTags(row.tags),
    }));
  }

  async countChunks() {
    const pool = await this.getPool();
    await this.ensureSchema();
    const result = await pool.query<{ count: number }>("select count(*)::int as count from knowledge_chunks");
    return Number(result.rows[0]?.count ?? 0);
  }

  async hasContent() {
    const pool = await this.getPool();
    await this.ensureSchema();
    const result = await pool.query<{ has_content: boolean }>(
      "select exists(select 1 from knowledge_chunks limit 1) as has_content",
    );
    return Boolean(result.rows[0]?.has_content);
  }

  provider() {
    return "pgvector" as const;
  }

  private async getPool() {
    this.poolPromise ??= import("pg").then(({ Pool }) => {
      const env = getEnv();
      if (!env.databaseUrl) {
        throw new Error("DATABASE_URL is required for pgvector.");
      }

      const useSsl = env.databaseSsl || env.databaseUrl.includes("sslmode=require");
      return new Pool({
        connectionString: env.databaseUrl,
        max: 4,
        idleTimeoutMillis: 20_000,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      });
    });

    return this.poolPromise;
  }

  private async ensureSchema() {
    if (this.initialized) {
      return;
    }

    const env = getEnv();
    const pool = await this.getPool();
    const dimensions = env.embeddingDimensions;

    try {
      await pool.query("create extension if not exists vector");
    } catch (error) {
      throw formatDatabaseError(error);
    }

    await pool.query(`
      create table if not exists knowledge_documents (
        id text primary key,
        name text not null,
        type text not null,
        status text not null,
        uploaded_at timestamptz not null,
        chunk_count integer not null,
        token_estimate integer not null,
        summary text not null,
        tags jsonb not null,
        created_at timestamptz not null default now()
      )
    `);
    await pool.query(`
      create table if not exists knowledge_chunks (
        id text primary key,
        document_id text not null,
        document_name text not null,
        chunk_index integer not null,
        content text not null,
        token_estimate integer not null,
        embedding vector(${dimensions}) not null,
        metadata jsonb not null,
        created_at timestamptz not null default now()
      )
    `);
    await pool.query(`
      create index if not exists knowledge_chunks_document_idx
      on knowledge_chunks (document_id)
    `);
    await pool.query(`
      create index if not exists knowledge_chunks_embedding_idx
      on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
      with (lists = 100)
    `);
    await pool.query(`
      create index if not exists knowledge_chunks_fts_idx
      on knowledge_chunks using gin (
        to_tsvector('english', document_name || ' ' || coalesce(metadata->>'section', '') || ' ' || content)
      )
    `);

    this.initialized = true;
  }
}

let vectorStore: VectorStore | null = null;

export function getVectorStore() {
  if (vectorStore) {
    return vectorStore;
  }

  const env = getEnv();
  if (env.vectorStore === "pgvector" && env.databaseUrl) {
    vectorStore = new PgVectorStore();
    logger.info("Using pgvector store");
    return vectorStore;
  }

  vectorStore = new InMemoryVectorStore();
  logger.info("Using in-memory vector store");
  return vectorStore;
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function vectorLiteral(vector: number[]) {
  return `[${vector.map((value) => (Number.isFinite(value) ? Number(value.toFixed(8)) : 0)).join(",")}]`;
}

type ChunkRow = {
  id: string;
  document_id: string;
  document_name: string;
  content: string;
  distance: number;
  metadata: unknown;
};

function rowToHit(row: ChunkRow, score: number, matchType: RetrievalHit["matchType"]): RetrievalHit {
  const metadata = normalizeMetadata(row.metadata);
  return {
    chunkId: row.id,
    documentId: row.document_id,
    documentName: row.document_name,
    content: row.content,
    score,
    confidence: confidenceForScore(score),
    matchType,
    section: metadata.section,
    page: metadata.page,
    tags: metadata.tags,
  };
}

function chunkToHit(chunk: KnowledgeChunk, score: number, matchType: RetrievalHit["matchType"]): RetrievalHit {
  return {
    chunkId: chunk.id,
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    content: chunk.content,
    score,
    confidence: confidenceForScore(score),
    matchType,
    section: chunk.metadata.section,
    page: chunk.metadata.page,
    tags: chunk.metadata.tags,
  };
}

function confidenceForScore(score: number): RetrievalHit["confidence"] {
  if (score >= 0.72) return "high";
  if (score >= 0.42) return "medium";
  return "low";
}

function keywordSimilarity(tokens: string[], chunk: KnowledgeChunk) {
  if (!tokens.length) return 0;
  const haystack = `${chunk.documentName} ${chunk.metadata.section} ${chunk.content}`.toLowerCase();
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  return matches / tokens.length;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function normalizeMetadata(value: unknown): KnowledgeChunk["metadata"] {
  if (!value || typeof value !== "object") {
    return { section: "Document excerpt", tags: ["uploaded"] };
  }

  const metadata = value as Partial<KnowledgeChunk["metadata"]>;
  return {
    section: typeof metadata.section === "string" ? metadata.section : "Document excerpt",
    page: typeof metadata.page === "number" ? metadata.page : undefined,
    tags: normalizeTags(metadata.tags),
  };
}

function normalizeTags(value: unknown) {
  return Array.isArray(value) && value.every((tag) => typeof tag === "string") ? value : ["uploaded"];
}

function formatDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown database error.";
  if (message.includes('extension "vector" is not available') || message.includes("could not open extension control file")) {
    return new Error(
      "pgvector is not available in this Postgres database. On Railway, use the pgvector Postgres template, then set DATABASE_URL and VECTOR_STORE=pgvector.",
    );
  }

  return error instanceof Error ? error : new Error(message);
}

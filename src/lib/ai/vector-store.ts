import type { KnowledgeChunk, RetrievalHit } from "@/lib/ai/types";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

export interface VectorStore {
  addChunks(chunks: KnowledgeChunk[]): Promise<void>;
  similaritySearch(embedding: number[], limit: number): Promise<RetrievalHit[]>;
  count(): number;
  provider(): "pgvector" | "In-memory";
}

export class InMemoryVectorStore implements VectorStore {
  private chunks = new Map<string, KnowledgeChunk>();

  async addChunks(chunks: KnowledgeChunk[]) {
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
      .map(({ chunk, score }) => ({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        content: chunk.content,
        score,
        section: chunk.metadata.section,
        page: chunk.metadata.page,
        tags: chunk.metadata.tags,
      }));
  }

  count() {
    return this.chunks.size;
  }

  provider(): "pgvector" | "In-memory" {
    return "In-memory";
  }
}

export class PgVectorStore implements VectorStore {
  private poolPromise: Promise<import("pg").Pool> | null = null;
  private initialized = false;
  private storedCount = 0;

  async addChunks(chunks: KnowledgeChunk[]) {
    const pool = await this.getPool();
    await this.ensureSchema();

    for (const chunk of chunks) {
      await pool.query(
        `insert into knowledge_chunks (
          id,
          document_id,
          document_name,
          chunk_index,
          content,
          token_estimate,
          embedding,
          metadata
        ) values ($1, $2, $3, $4, $5, $6, $7::vector, $8)
        on conflict (id) do update set
          content = excluded.content,
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

    this.storedCount += chunks.length;
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
      metadata: KnowledgeChunk["metadata"];
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

    return result.rows.map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      documentName: row.document_name,
      content: row.content,
      score: Math.max(0, 1 - Number(row.distance)),
      section: row.metadata.section,
      page: row.metadata.page,
      tags: row.metadata.tags,
    }));
  }

  count() {
    return this.storedCount;
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

      return new Pool({
        connectionString: env.databaseUrl,
        max: 4,
        idleTimeoutMillis: 20_000,
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

    await pool.query("create extension if not exists vector");
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
      create index if not exists knowledge_chunks_embedding_idx
      on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
      with (lists = 100)
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
  return `[${vector.map((value) => Number(value.toFixed(8))).join(",")}]`;
}

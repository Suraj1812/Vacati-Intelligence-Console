create extension if not exists vector;

create table if not exists knowledge_chunks (
  id text primary key,
  document_id text not null,
  document_name text not null,
  chunk_index integer not null,
  content text not null,
  token_estimate integer not null,
  embedding vector(384) not null,
  metadata jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_document_idx
  on knowledge_chunks (document_id);

create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

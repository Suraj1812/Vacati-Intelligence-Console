create extension if not exists vector;

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
);

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

create index if not exists knowledge_chunks_fts_idx
  on knowledge_chunks using gin (
    to_tsvector('english', document_name || ' ' || coalesce(metadata->>'section', '') || ' ' || content)
  );

export type KnowledgeDocumentStatus = "queued" | "chunked" | "embedded" | "indexed";

export type KnowledgeDocument = {
  id: string;
  name: string;
  type: "pdf" | "docx" | "markdown" | "text" | "csv" | "xlsx" | "image";
  status: KnowledgeDocumentStatus;
  uploadedAt: string;
  chunkCount: number;
  tokenEstimate: number;
  summary: string;
  tags: string[];
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  documentName: string;
  index: number;
  content: string;
  tokenEstimate: number;
  embedding: number[];
  metadata: {
    section: string;
    page?: number;
    tags: string[];
  };
};

export type RetrievalHit = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  confidence: "high" | "medium" | "low";
  matchType: "hybrid" | "vector" | "keyword";
  section: string;
  page?: number;
  tags: string[];
};

export type Explainability = {
  why: string;
  confidence: number;
  flavorLogic: string;
  retrievedContext: string[];
  tags: string[];
  mode: "grounded" | "general";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: RetrievalHit[];
  explainability?: Explainability;
};

export type ChatSession = {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type KnowledgeState = {
  documents: KnowledgeDocument[];
  totalChunks: number;
  embeddingStatus: "ready" | "indexing";
  retrievalHits: RetrievalHit[];
  activeSources: string[];
};

export type SystemStatus = {
  provider: string;
  activeProviderId: string;
  model: string;
  providerHealth: Array<{
    provider: string;
    healthy: boolean;
    latencyMs: number;
    message: string;
  }>;
  embeddingModel: string;
  embeddingProvider: string;
  vectorDatabase: "pgvector" | "In-memory";
  tokenUsage: {
    prompt: number;
    completion: number;
    embedding: number;
  };
  latency: {
    retrievalMs: number;
    generationMs: number;
    totalMs: number;
  };
  health: {
    api: "healthy" | "degraded";
    embeddings: "healthy" | "degraded";
    grounding: "healthy" | "degraded";
  };
  cache: {
    hits: number;
    entries: number;
  };
  errors: {
    provider: number;
  };
  ingestion: {
    documents: number;
    chunks: number;
    activeSources: number;
    lastRetrievalHits: number;
  };
};

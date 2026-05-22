export type KnowledgeDocumentStatus = "queued" | "chunked" | "embedded" | "indexed";

export type KnowledgeDocument = {
  id: string;
  name: string;
  type: "pdf" | "manual" | "menu" | "wine-guide" | "policy" | "text";
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
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: RetrievalHit[];
  explainability?: Explainability;
};

export type KnowledgeState = {
  documents: KnowledgeDocument[];
  totalChunks: number;
  embeddingStatus: "ready" | "fallback" | "indexing";
  retrievalHits: RetrievalHit[];
  activeSources: string[];
};

export type SystemStatus = {
  provider: string;
  activeProviderId: string;
  model: string;
  fallbackProvider: string;
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
    embeddings: "healthy" | "fallback";
    grounding: "healthy";
  };
  cache: {
    hits: number;
    entries: number;
  };
  errors: {
    provider: number;
  };
};

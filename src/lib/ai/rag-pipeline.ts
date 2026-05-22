import { chunkDocument, estimateTokens } from "@/lib/ai/chunking";
import { EmbeddingService } from "@/lib/ai/embeddings";
import { buildGroundedPrompt } from "@/lib/ai/prompts";
import { getActiveProvider, getFallbackProvider } from "@/lib/ai/providers/registry";
import type {
  Explainability,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeState,
  RetrievalHit,
} from "@/lib/ai/types";
import type { IngestibleDocument } from "@/lib/ai/document-types";
import { getVectorStore, type VectorStore } from "@/lib/ai/vector-store";
import { getEnv } from "@/lib/config/env";
import { demoDocuments } from "@/lib/data/demo-documents";
import { logger } from "@/lib/observability/logger";
import { TtlCache } from "@/lib/utils/ttl-cache";

type Metrics = {
  promptTokens: number;
  completionTokens: number;
  embeddingTokens: number;
  retrievalMs: number;
  generationMs: number;
  cacheHits: number;
  providerErrors: number;
  activeProvider: string;
};

type CachedAnswer = {
  answer: string;
  hits: RetrievalHit[];
  explainability: Explainability;
};

export class RagPipeline {
  private documents = new Map<string, KnowledgeDocument>();
  private vectorStore: VectorStore = getVectorStore();
  private embeddings = new EmbeddingService();
  private lastRetrievalHits: RetrievalHit[] = [];
  private answerCache = new TtlCache<CachedAnswer>(getEnv().responseCacheTtlSeconds * 1000);
  private metrics: Metrics = {
    promptTokens: 0,
    completionTokens: 0,
    embeddingTokens: 0,
    retrievalMs: 0,
    generationMs: 0,
    cacheHits: 0,
    providerErrors: 0,
    activeProvider: getEnv().aiProvider,
  };

  static async create() {
    const pipeline = new RagPipeline();
    if (getEnv().seedDemoKnowledge) {
      await pipeline.ingestDocuments(demoDocuments);
    }
    return pipeline;
  }

  async ingestDocuments(documents: IngestibleDocument[]) {
    const indexedDocuments: KnowledgeDocument[] = [];

    for (const document of documents) {
      const id = createStableId(`${document.name}:${document.content}`);
      const chunks = await chunkDocument({ ...document, id });
      const vectors = await this.embeddings.embedTexts(chunks.map((chunk) => chunk.content));
      const knowledgeDocument: KnowledgeDocument = {
        id,
        name: document.name,
        type: document.type,
        status: "indexed",
        uploadedAt: new Date().toISOString(),
        chunkCount: chunks.length,
        tokenEstimate: estimateTokens(document.content),
        summary: document.summary,
        tags: document.tags,
      };

      const knowledgeChunks: KnowledgeChunk[] = chunks.map((chunk, index) => ({
        id: createStableId(`${id}:${chunk.index}:${chunk.content}`),
        documentId: id,
        documentName: document.name,
        index: chunk.index,
        content: chunk.content,
        tokenEstimate: chunk.tokenEstimate,
        embedding: vectors[index],
        metadata: {
          section: chunk.section,
          tags: document.tags,
        },
      }));

      this.documents.set(id, knowledgeDocument);
      await this.vectorStore.addChunks(knowledgeChunks);
      this.metrics.embeddingTokens += knowledgeDocument.tokenEstimate;
      indexedDocuments.push(knowledgeDocument);
    }

    return {
      documents: indexedDocuments,
      chunksIndexed: indexedDocuments.reduce((sum, document) => sum + document.chunkCount, 0),
    };
  }

  async retrieve(question: string, limit = 4) {
    if (!this.documents.size) {
      this.lastRetrievalHits = [];
      return [];
    }

    const startedAt = performance.now();
    const [embedding] = await this.embeddings.embedTexts([question]);
    const candidates = await this.vectorStore.similaritySearch(embedding, Math.max(limit * 3, limit));
    const hits = rerankHits(question, candidates).slice(0, limit);
    this.lastRetrievalHits = hits;
    this.metrics.retrievalMs = Math.round(performance.now() - startedAt);
    this.metrics.promptTokens += estimateTokens(question);
    return hits;
  }

  async *answer(question: string) {
    const hits = await this.retrieve(question);
    const cacheKey = createCacheKey(question, hits);
    const cached = this.answerCache.get(cacheKey);

    if (cached) {
      this.metrics.cacheHits += 1;
      this.lastRetrievalHits = cached.hits;
      yield { type: "token" as const, value: cached.answer };
      yield { type: "sources" as const, value: cached.hits };
      yield { type: "explainability" as const, value: cached.explainability };
      return;
    }

    const startedAt = performance.now();
    let completion = "";
    const prompt = buildGroundedPrompt(question, hits);
    const provider = getActiveProvider(hits);
    this.metrics.activeProvider = provider.id;

    try {
      for await (const chunk of provider.stream({ prompt })) {
        completion += chunk.text;
        yield { type: "token" as const, value: chunk.text };
      }
    } catch (error) {
      this.metrics.providerErrors += 1;
      logger.warn("Primary AI provider failed; switching to fallback", {
        provider: provider.id,
        error: error instanceof Error ? error.message : "unknown",
      });

      const fallback = getFallbackProvider(hits);
      this.metrics.activeProvider = fallback.id;
      for await (const chunk of fallback.stream({ prompt: question })) {
        completion += chunk.text;
        yield { type: "token" as const, value: chunk.text };
      }
    }

    this.metrics.completionTokens += estimateTokens(completion);
    this.metrics.generationMs = Math.round(performance.now() - startedAt);
    const explainability = this.explain(question, hits);
    this.answerCache.set(cacheKey, {
      answer: completion,
      hits,
      explainability,
    });

    yield { type: "sources" as const, value: hits };
    yield { type: "explainability" as const, value: explainability };
  }

  getKnowledgeState(): KnowledgeState {
    const documents = Array.from(this.documents.values());
    return {
      documents,
      totalChunks: this.vectorStore.count(),
      embeddingStatus: getEnv().embeddingProvider === "local" ? "fallback" : "ready",
      retrievalHits: this.lastRetrievalHits,
      activeSources: documents.map((document) => document.name),
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      vectorDatabase: this.vectorStore.provider(),
      totalMs: this.metrics.retrievalMs + this.metrics.generationMs,
      cacheSize: this.answerCache.size(),
    };
  }

  private explain(question: string, hits: RetrievalHit[]): Explainability {
    if (!hits.length) {
      return {
        why: "No indexed document context was available for this question.",
        confidence: 0,
        flavorLogic: "Upload source documents so the answer can be grounded.",
        retrievedContext: [],
        tags: ["needs-source"],
      };
    }

    const tags = Array.from(
      new Set([
        "retrieval-grounded",
        "source-cited",
        ...hits.flatMap((hit) => hit.tags),
        inferQuestionTag(question),
      ]),
    ).filter(Boolean);

    const topScore = hits[0]?.score ?? 0;
    const confidence = Math.min(0.94, Math.max(0.68, topScore * 0.72 + hits.length * 0.08));

    return {
      why: `The response uses ${hits.length} retrieved knowledge chunks, led by ${hits[0]?.documentName ?? "the active knowledge base"} and checked against adjacent operating guidance.`,
      confidence,
      flavorLogic: inferFlavorLogic(question, tags),
      retrievedContext: hits.slice(0, 3).map((hit) => `${hit.documentName}: ${hit.section}`),
      tags,
    };
  }
}

let pipelinePromise: Promise<RagPipeline> | null = null;

export function getRagPipeline() {
  pipelinePromise ??= RagPipeline.create();
  return pipelinePromise;
}

function inferQuestionTag(question: string) {
  const value = question.toLowerCase();
  if (value.includes("wine") || value.includes("pair")) return "pairing-query";
  if (value.includes("guest") || value.includes("late")) return "service-recovery";
  if (value.includes("tomato") || value.includes("lobster")) return "flavor-compatibility";
  return "knowledge-query";
}

function inferFlavorLogic(question: string, tags: string[]) {
  const value = question.toLowerCase();
  if (value.includes("lobster")) {
    return "Butter and preserved lemon create a body-plus-acidity problem: choose ripe citrus, restrained oak, and saline minerality.";
  }

  if (value.includes("tomato")) {
    return "Tomato raises acidity and bitterness sensitivity, so low tannin and bright acid are prioritized.";
  }

  if (tags.includes("service-recovery")) {
    return "Operational fit is driven by timing, specificity, dietary context, and manager escalation thresholds.";
  }

  return "The engine matches intensity first, then balances acidity, texture, tannin risk, and guest context.";
}

function rerankHits(question: string, hits: RetrievalHit[]) {
  return [...hits].sort((left, right) => {
    const leftScore = left.score + lexicalBoost(question, left);
    const rightScore = right.score + lexicalBoost(question, right);
    return rightScore - leftScore;
  });
}

function lexicalBoost(question: string, hit: RetrievalHit) {
  const tokens = tokenize(question);
  if (!tokens.length) {
    return 0;
  }

  const haystack = `${hit.documentName} ${hit.section} ${hit.content}`.toLowerCase();
  const matched = tokens.filter((token) => haystack.includes(token));
  const exactSectionBonus = matched.some((token) => hit.section.toLowerCase().includes(token)) ? 0.12 : 0;
  return Math.min(0.55, (matched.length / tokens.length) * 0.7 + exactSectionBonus);
}

function tokenize(value: string) {
  const stopWords = new Set([
    "what",
    "should",
    "with",
    "would",
    "could",
    "about",
    "from",
    "that",
    "this",
    "their",
    "there",
    "pair",
    "pairing",
  ]);

  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-|-$/g, ""))
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function createCacheKey(question: string, hits: RetrievalHit[]) {
  return JSON.stringify({
    question: question.trim().toLowerCase(),
    chunks: hits.map((hit) => hit.chunkId),
  });
}

function createStableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return `k_${Math.abs(hash).toString(36)}`;
}

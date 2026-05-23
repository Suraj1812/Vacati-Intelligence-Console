import { chunkDocument, estimateTokens } from "@/lib/ai/chunking";
import { EmbeddingService } from "@/lib/ai/embeddings";
import { buildGeneralPrompt, buildGroundedPrompt } from "@/lib/ai/prompts";
import { getActiveProvider } from "@/lib/ai/providers/registry";
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

type PromptTurn = {
  role: "user" | "assistant";
  content: string;
};

export class RagPipeline {
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
    return new RagPipeline();
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

      await this.vectorStore.addDocument(knowledgeDocument, knowledgeChunks);
      this.metrics.embeddingTokens += knowledgeDocument.tokenEstimate;
      indexedDocuments.push(knowledgeDocument);
    }

    return {
      documents: indexedDocuments,
      chunksIndexed: indexedDocuments.reduce((sum, document) => sum + document.chunkCount, 0),
    };
  }

  async retrieve(question: string, limit = getEnv().ragTopK) {
    if (!(await this.vectorStore.hasContent())) {
      this.lastRetrievalHits = [];
      return [];
    }

    const startedAt = performance.now();
    try {
      const [embedding] = await this.embeddings.embedTexts([question]);
      const candidateLimit = Math.max(limit * getEnv().ragCandidateMultiplier, 24);
      const candidates = await this.vectorStore.hybridSearch(question, embedding, candidateLimit);
      const hits = rerankHits(question, candidates)
        .filter((hit) => hit.score > 0.16 || lexicalOverlap(question, hit) > 0.18)
        .filter(dedupeHits())
        .slice(0, limit);
      this.lastRetrievalHits = hits;
      this.metrics.retrievalMs = Math.round(performance.now() - startedAt);
      this.metrics.promptTokens += estimateTokens(question);
      logger.info("retrieval_completed", {
        candidates: candidates.length,
        hits: hits.length,
        retrievalMs: this.metrics.retrievalMs,
        topScore: hits[0]?.score ?? 0,
      });
      return hits;
    } catch (error) {
      logger.error("vector_search_failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  }

  async *answer(question: string, history: PromptTurn[] = []) {
    const hasIndexedKnowledge = await this.vectorStore.hasContent();
    const hits = hasIndexedKnowledge ? await this.retrieve(question) : [];
    if (!hits.length) {
      const startedAt = performance.now();
      const prompt = buildGeneralPrompt(question, history);
      const provider = getActiveProvider([]);
      this.metrics.activeProvider = provider.id;
      let completion = "";

      try {
        for await (const chunk of provider.stream({ prompt, temperature: 0.2, maxOutputTokens: 900 })) {
          completion += chunk.text;
          yield { type: "token" as const, value: chunk.text };
        }
      } catch (error) {
        this.metrics.providerErrors += 1;
        logger.error("Configured AI provider failed", {
          provider: provider.id,
          error: error instanceof Error ? error.message : "unknown",
        });
        throw new Error("The configured AI provider failed before an answer could be generated.");
      }

      if (!completion.trim()) {
        throw new Error("The configured AI provider returned an empty response.");
      }

      const explainability = this.explainGeneral(hasIndexedKnowledge);
      this.metrics.promptTokens += estimateTokens(question);
      this.metrics.completionTokens += estimateTokens(completion);
      this.metrics.generationMs = Math.round(performance.now() - startedAt);

      yield { type: "sources" as const, value: [] };
      yield { type: "explainability" as const, value: explainability };
      return;
    }

    const compressedHits = compressHits(question, hits);
    const cacheKey = createCacheKey(question, compressedHits, history);
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
    const prompt = buildGroundedPrompt(question, compressedHits, history);
    const provider = getActiveProvider(compressedHits);
    this.metrics.activeProvider = provider.id;

    try {
      for await (const chunk of provider.stream({ prompt })) {
        completion += chunk.text;
        yield { type: "token" as const, value: chunk.text };
      }
    } catch (error) {
      this.metrics.providerErrors += 1;
      logger.error("Configured AI provider failed", {
        provider: provider.id,
        error: error instanceof Error ? error.message : "unknown",
      });
      throw new Error("The configured AI provider failed before a grounded answer could be generated.");
    }

    if (!completion.trim()) {
      throw new Error("The configured AI provider returned an empty grounded response.");
    }

    this.metrics.completionTokens += estimateTokens(completion);
    this.metrics.generationMs = Math.round(performance.now() - startedAt);
    const explainability = this.explain(question, compressedHits);
    this.answerCache.set(cacheKey, {
      answer: completion,
      hits: compressedHits,
      explainability,
    });

    yield { type: "sources" as const, value: compressedHits };
    yield { type: "explainability" as const, value: explainability };
  }

  async getKnowledgeState(): Promise<KnowledgeState> {
    const documents = await this.vectorStore.listDocuments();
    return {
      documents,
      totalChunks: await this.vectorStore.countChunks(),
      embeddingStatus: "ready",
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

  private explain(_question: string, hits: RetrievalHit[]): Explainability {
    if (!hits.length) {
      return {
        why: "No indexed document context was available for this question.",
        confidence: 0,
        flavorLogic: "No compatibility logic was generated because no source chunks were retrieved.",
        retrievedContext: [],
        tags: ["needs-source"],
        mode: "grounded",
      };
    }

    const evidenceTags = extractEvidenceTags(hits);
    const tags = Array.from(new Set(["retrieval-grounded", "source-cited", ...hits.flatMap((hit) => hit.tags), ...evidenceTags])).filter(Boolean);

    const topScore = hits[0]?.score ?? 0;
    const confidence = Math.min(0.94, Math.max(0.42, topScore * 0.74 + Math.min(hits.length, 4) * 0.06));
    const sourceNames = Array.from(new Set(hits.map((hit) => hit.documentName))).slice(0, 3);

    return {
      why: `The response is grounded in ${hits.length} retrieved chunk${hits.length === 1 ? "" : "s"} from ${sourceNames.join(", ")}. The top retrieval score was ${Math.round(topScore * 100)}%.`,
      confidence,
      flavorLogic: buildCompatibilityLogic(hits),
      retrievedContext: hits.slice(0, 3).map((hit) => `${hit.documentName}: ${hit.section}`),
      tags,
      mode: "grounded",
    };
  }

  private explainGeneral(hasIndexedKnowledge: boolean): Explainability {
    return {
      why: hasIndexedKnowledge
        ? "No close document match was retrieved, so this response used the configured general model instead of uploaded sources."
        : "No uploaded knowledge is indexed yet, so this response used the configured general model.",
      confidence: 0.58,
      flavorLogic:
        "This answer is not grounded in uploaded source chunks. Treat time-sensitive or business-critical claims as needing live verification.",
      retrievedContext: [],
      tags: ["general-answer", hasIndexedKnowledge ? "no-source-match" : "no-uploaded-sources"],
      mode: "general",
    };
  }
}

let pipelinePromise: Promise<RagPipeline> | null = null;

export function getRagPipeline() {
  pipelinePromise ??= RagPipeline.create();
  return pipelinePromise;
}

function rerankHits(question: string, hits: RetrievalHit[]) {
  return hits
    .map((hit) => ({
      ...hit,
      score: Math.min(1, Math.max(0, hit.score * 0.62 + lexicalScore(question, hit) * 0.38)),
    }))
    .sort((left, right) => right.score - left.score);
}

function dedupeHits() {
  const seen = new Set<string>();
  return (hit: RetrievalHit) => {
    const key = normalizeForDedupe(hit.content).slice(0, 220);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
}

function compressHits(question: string, hits: RetrievalHit[]) {
  const tokens = tokenize(question);
  return hits.map((hit) => ({
    ...hit,
    content: compressContent(hit.content, tokens),
  }));
}

function compressContent(content: string, tokens: string[]) {
  const sentences = content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 3) {
    return content.length > 1_400 ? `${content.slice(0, 1_397)}...` : content;
  }

  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: tokens.filter((token) => sentence.toLowerCase().includes(token)).length,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 5)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence)
    .join(" ");

  return ranked.length > 1_400 ? `${ranked.slice(0, 1_397)}...` : ranked;
}

function normalizeForDedupe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function lexicalScore(question: string, hit: RetrievalHit) {
  const tokens = tokenize(question);
  if (!tokens.length) {
    return 0;
  }

  const haystack = `${hit.documentName} ${hit.section} ${hit.content}`.toLowerCase();
  const matched = tokens.filter((token) => haystack.includes(token));
  const titleMatches = tokens.filter((token) => `${hit.documentName} ${hit.section}`.toLowerCase().includes(token));
  const phrase = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const phraseBonus = phrase.length > 8 && haystack.includes(phrase) ? 0.18 : 0;
  const titleBonus = Math.min(0.2, (titleMatches.length / tokens.length) * 0.25);

  return Math.min(1, matched.length / tokens.length + titleBonus + phraseBonus);
}

function lexicalOverlap(question: string, hit: RetrievalHit) {
  const tokens = tokenize(question);
  if (!tokens.length) return 0;
  const haystack = `${hit.documentName} ${hit.section} ${hit.content}`.toLowerCase();
  return tokens.filter((token) => haystack.includes(token)).length / tokens.length;
}

function extractEvidenceTags(hits: RetrievalHit[]) {
  const evidenceTerms = [
    "acid",
    "acidity",
    "aroma",
    "body",
    "texture",
    "tannin",
    "sweetness",
    "salt",
    "saline",
    "spice",
    "richness",
    "service",
    "policy",
    "allergy",
    "timing",
  ];
  const corpus = hits.map((hit) => hit.content.toLowerCase()).join(" ");
  return evidenceTerms.filter((term) => corpus.includes(term)).slice(0, 8);
}

function buildCompatibilityLogic(hits: RetrievalHit[]) {
  const terms = extractEvidenceTags(hits).filter((term) =>
    ["acid", "acidity", "aroma", "body", "texture", "tannin", "sweetness", "salt", "saline", "spice", "richness"].includes(term),
  );

  if (!terms.length) {
    return "The retrieved chunks did not contain explicit flavor compatibility signals, so no extra compatibility claim was inferred.";
  }

  return `Compatibility reasoning is limited to retrieved source language mentioning ${terms.join(", ")}. No unstated pairings or sensory claims were added.`;
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

function createCacheKey(question: string, hits: RetrievalHit[], history: PromptTurn[] = []) {
  return JSON.stringify({
    question: question.trim().toLowerCase(),
    chunks: hits.map((hit) => hit.chunkId),
    history: history.slice(-4).map((turn) => `${turn.role}:${turn.content.slice(0, 240)}`),
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

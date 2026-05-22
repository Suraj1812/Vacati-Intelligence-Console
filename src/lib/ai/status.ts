import type { SystemStatus } from "@/lib/ai/types";
import { createProvider } from "@/lib/ai/providers/registry";
import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { getEnv, type AppEnv } from "@/lib/config/env";

export async function getSystemStatus(): Promise<SystemStatus> {
  const env = getEnv();
  const pipeline = await getRagPipeline();
  const metrics = pipeline.getMetrics();
  const knowledge = pipeline.getKnowledgeState();
  const activeProvider = safeCreateProvider(env);
  const providerHealth = [await activeProvider.health()];

  return {
    provider: activeProvider.displayName,
    activeProviderId: env.aiProvider,
    model: activeProvider.model,
    providerHealth: providerHealth.map((health) => ({
      provider: health.provider,
      healthy: health.healthy,
      latencyMs: health.latencyMs,
      message: health.message,
    })),
    embeddingModel: env.embeddingModel,
    embeddingProvider: env.embeddingProvider,
    vectorDatabase: metrics.vectorDatabase,
    tokenUsage: {
      prompt: metrics.promptTokens,
      completion: metrics.completionTokens,
      embedding: metrics.embeddingTokens,
    },
    latency: {
      retrievalMs: metrics.retrievalMs,
      generationMs: metrics.generationMs,
      totalMs: metrics.totalMs,
    },
    health: {
      api: providerHealth[0]?.healthy ? "healthy" : "degraded",
      embeddings: isEmbeddingConfigured(env) ? "healthy" : "degraded",
      grounding: knowledge.totalChunks > 0 ? "healthy" : "degraded",
    },
    cache: {
      hits: metrics.cacheHits,
      entries: metrics.cacheSize,
    },
    errors: {
      provider: metrics.providerErrors,
    },
    ingestion: {
      documents: knowledge.documents.length,
      chunks: knowledge.totalChunks,
      activeSources: knowledge.activeSources.length,
      lastRetrievalHits: knowledge.retrievalHits.length,
    },
  };
}

function safeCreateProvider(env: AppEnv) {
  try {
    return createProvider(env.aiProvider);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider is not configured.";
    return {
      id: env.aiProvider,
      displayName: env.aiProvider,
      model: "not configured",
      async *stream() {
        throw new Error(message);
      },
      async health() {
        return {
          provider: env.aiProvider,
          healthy: false,
          latencyMs: 0,
          message,
        };
      },
    };
  }
}

function isEmbeddingConfigured(env: AppEnv) {
  if (env.embeddingProvider === "local") return true;
  if (env.embeddingProvider === "gemini") return Boolean(env.geminiApiKey);
  if (env.embeddingProvider === "ollama") return Boolean(env.ollamaBaseUrl);
  if (env.embeddingProvider === "openai-compatible") return Boolean(env.openAiCompatibleBaseUrl);
  return false;
}

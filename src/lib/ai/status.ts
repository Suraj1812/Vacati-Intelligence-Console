import type { SystemStatus } from "@/lib/ai/types";
import { createProvider } from "@/lib/ai/providers/registry";
import { getRagPipeline } from "@/lib/ai/rag-pipeline";
import { getEnv } from "@/lib/config/env";

export async function getSystemStatus(): Promise<SystemStatus> {
  const env = getEnv();
  const pipeline = await getRagPipeline();
  const metrics = pipeline.getMetrics();
  const activeProvider = createProvider(env.aiProvider);
  const fallbackProvider = createProvider(env.fallbackProvider);
  const providerHealth = await Promise.all([
    activeProvider.health(),
    ...(env.fallbackProvider === env.aiProvider ? [] : [fallbackProvider.health()]),
  ]);

  return {
    provider: activeProvider.displayName,
    activeProviderId: env.aiProvider,
    model: activeProvider.model,
    fallbackProvider: fallbackProvider.displayName,
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
      embeddings: env.embeddingProvider === "local" ? "fallback" : "healthy",
      grounding: "healthy",
    },
    cache: {
      hits: metrics.cacheHits,
      entries: metrics.cacheSize,
    },
    errors: {
      provider: metrics.providerErrors,
    },
  };
}

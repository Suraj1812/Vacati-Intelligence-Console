import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { LocalProvider } from "@/lib/ai/providers/local";
import { OllamaProvider } from "@/lib/ai/providers/ollama";
import { OpenAiCompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import type { AiProviderAdapter } from "@/lib/ai/providers/types";
import { VertexProvider } from "@/lib/ai/providers/vertex";
import type { RetrievalHit } from "@/lib/ai/types";
import { getEnv, type AiProvider } from "@/lib/config/env";

export function createProvider(provider: AiProvider, hits: RetrievalHit[] = []): AiProviderAdapter {
  const env = getEnv();

  if (provider === "gemini" && env.geminiApiKey) {
    return new GeminiProvider(env.geminiApiKey, env.geminiModel);
  }

  if (provider === "vertex" && env.googleCloudProject) {
    return new VertexProvider(env.googleCloudProject, env.googleCloudLocation, env.geminiModel);
  }

  if (provider === "ollama") {
    return new OllamaProvider(env.ollamaBaseUrl, env.ollamaModel);
  }

  if (provider === "openrouter" && env.openRouterApiKey) {
    return new OpenAiCompatibleProvider({
      id: "openrouter",
      displayName: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env.openRouterApiKey,
      model: env.openRouterModel,
      headers: {
        "HTTP-Referer": "https://vacati.ai",
        "X-Title": "Vacati Intelligence Console",
      },
    });
  }

  if (provider === "openai-compatible" && (env.openAiCompatibleBaseUrl || env.localLlmBaseUrl)) {
    return new OpenAiCompatibleProvider({
      id: "openai-compatible",
      displayName: "OpenAI-compatible",
      baseUrl: env.openAiCompatibleBaseUrl ?? env.localLlmBaseUrl ?? "http://localhost:1234/v1",
      apiKey: env.openAiCompatibleApiKey,
      model: env.openAiCompatibleModel,
    });
  }

  if (provider === "vllm") {
    return new OpenAiCompatibleProvider({
      id: "vllm",
      displayName: "vLLM",
      baseUrl: env.localLlmBaseUrl ?? "http://localhost:8000/v1",
      apiKey: env.openAiCompatibleApiKey,
      model: env.localLlmModel,
    });
  }

  if (provider === "lmstudio") {
    return new OpenAiCompatibleProvider({
      id: "lmstudio",
      displayName: "LM Studio",
      baseUrl: env.localLlmBaseUrl ?? "http://localhost:1234/v1",
      apiKey: env.openAiCompatibleApiKey,
      model: env.localLlmModel,
    });
  }

  return new LocalProvider(hits);
}

export function getActiveProvider(hits: RetrievalHit[] = []) {
  const env = getEnv();
  return createProvider(env.aiProvider, hits);
}

export function getFallbackProvider(hits: RetrievalHit[] = []) {
  const env = getEnv();
  return createProvider(env.fallbackProvider, hits);
}

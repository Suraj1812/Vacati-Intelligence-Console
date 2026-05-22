import { z } from "zod";

export const aiProviderSchema = z.enum([
  "local",
  "gemini",
  "vertex",
  "ollama",
  "openrouter",
  "openai-compatible",
  "vllm",
  "lmstudio",
]);

export const embeddingProviderSchema = z.enum([
  "local",
  "gemini",
  "ollama",
  "openai-compatible",
]);

export const vectorProviderSchema = z.enum(["memory", "pgvector"]);

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type EmbeddingProvider = z.infer<typeof embeddingProviderSchema>;
export type VectorProvider = z.infer<typeof vectorProviderSchema>;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AI_PROVIDER: z.preprocess(emptyToUndefined, aiProviderSchema.optional()),
  AI_FALLBACK_PROVIDER: aiProviderSchema.default("local"),
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GOOGLE_CLOUD_PROJECT: optionalString,
  GOOGLE_CLOUD_LOCATION: z.string().default("us-central1"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.1:8b"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_MODEL: z.string().default("meta-llama/llama-3.1-8b-instruct"),
  OPENAI_COMPATIBLE_BASE_URL: optionalUrl,
  OPENAI_COMPATIBLE_API_KEY: optionalString,
  OPENAI_COMPATIBLE_MODEL: z.string().default("gpt-4o-mini"),
  LOCAL_LLM_BASE_URL: optionalUrl,
  LOCAL_LLM_MODEL: z.string().default("local-model"),
  EMBEDDING_PROVIDER: z.preprocess(emptyToUndefined, embeddingProviderSchema.optional()),
  EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(64).max(4096).default(384),
  VECTOR_STORE: vectorProviderSchema.default("memory"),
  DATABASE_URL: optionalString,
  RAG_TOP_K: z.coerce.number().int().min(2).max(12).default(4),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(12),
  RESPONSE_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86400).default(900),
  SEED_DEMO_KNOWLEDGE: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppEnv = {
  nodeEnv: "development" | "test" | "production";
  aiProvider: AiProvider;
  fallbackProvider: AiProvider;
  geminiApiKey?: string;
  geminiModel: string;
  googleCloudProject?: string;
  googleCloudLocation: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  openRouterApiKey?: string;
  openRouterModel: string;
  openAiCompatibleBaseUrl?: string;
  openAiCompatibleApiKey?: string;
  openAiCompatibleModel: string;
  localLlmBaseUrl?: string;
  localLlmModel: string;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
  embeddingDimensions: number;
  vectorStore: VectorProvider;
  databaseUrl?: string;
  ragTopK: number;
  maxUploadMb: number;
  responseCacheTtlSeconds: number;
  seedDemoKnowledge: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
};

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function getEnv(): AppEnv {
  cachedEnv ??= envSchema.parse(process.env);
  const hasVertexProject = Boolean(cachedEnv.GOOGLE_CLOUD_PROJECT);
  const hasGeminiKey = Boolean(cachedEnv.GEMINI_API_KEY);
  const hasOpenRouterKey = Boolean(cachedEnv.OPENROUTER_API_KEY);
  const hasCompatibleEndpoint = Boolean(cachedEnv.OPENAI_COMPATIBLE_BASE_URL);
  const hasLocalEndpoint = Boolean(cachedEnv.LOCAL_LLM_BASE_URL);
  const configuredProvider = cachedEnv.AI_PROVIDER;
  const aiProvider =
    configuredProvider ??
    (hasLocalEndpoint
      ? "openai-compatible"
      : hasCompatibleEndpoint
        ? "openai-compatible"
        : hasOpenRouterKey
          ? "openrouter"
          : hasVertexProject
            ? "vertex"
            : hasGeminiKey
              ? "gemini"
              : "local");
  const embeddingProvider =
    cachedEnv.EMBEDDING_PROVIDER ??
    (cachedEnv.OLLAMA_BASE_URL && cachedEnv.AI_PROVIDER === "ollama"
      ? "ollama"
      : hasCompatibleEndpoint
        ? "openai-compatible"
        : hasGeminiKey
          ? "gemini"
          : "local");

  return {
    nodeEnv: cachedEnv.NODE_ENV,
    aiProvider,
    fallbackProvider: cachedEnv.AI_FALLBACK_PROVIDER,
    geminiApiKey: cachedEnv.GEMINI_API_KEY,
    geminiModel: cachedEnv.GEMINI_MODEL,
    googleCloudProject: cachedEnv.GOOGLE_CLOUD_PROJECT,
    googleCloudLocation: cachedEnv.GOOGLE_CLOUD_LOCATION,
    ollamaBaseUrl: cachedEnv.OLLAMA_BASE_URL,
    ollamaModel: cachedEnv.OLLAMA_MODEL,
    ollamaEmbeddingModel: cachedEnv.OLLAMA_EMBEDDING_MODEL,
    openRouterApiKey: cachedEnv.OPENROUTER_API_KEY,
    openRouterModel: cachedEnv.OPENROUTER_MODEL,
    openAiCompatibleBaseUrl: cachedEnv.OPENAI_COMPATIBLE_BASE_URL,
    openAiCompatibleApiKey: cachedEnv.OPENAI_COMPATIBLE_API_KEY,
    openAiCompatibleModel: cachedEnv.OPENAI_COMPATIBLE_MODEL,
    localLlmBaseUrl: cachedEnv.LOCAL_LLM_BASE_URL,
    localLlmModel: cachedEnv.LOCAL_LLM_MODEL,
    embeddingProvider,
    embeddingModel: cachedEnv.EMBEDDING_MODEL,
    embeddingDimensions: cachedEnv.EMBEDDING_DIMENSIONS,
    vectorStore: cachedEnv.VECTOR_STORE,
    databaseUrl: cachedEnv.DATABASE_URL,
    ragTopK: cachedEnv.RAG_TOP_K,
    maxUploadMb: cachedEnv.MAX_UPLOAD_MB,
    responseCacheTtlSeconds: cachedEnv.RESPONSE_CACHE_TTL_SECONDS,
    seedDemoKnowledge: cachedEnv.SEED_DEMO_KNOWLEDGE,
    logLevel: cachedEnv.LOG_LEVEL,
  };
}

export function hasProductionVectorStore() {
  const env = getEnv();
  return env.vectorStore === "pgvector" && Boolean(env.databaseUrl);
}

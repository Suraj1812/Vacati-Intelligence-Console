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
const envBoolean = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}, z.boolean());

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type EmbeddingProvider = z.infer<typeof embeddingProviderSchema>;
export type VectorProvider = z.infer<typeof vectorProviderSchema>;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AI_PROVIDER: z.preprocess(emptyToUndefined, aiProviderSchema.optional()),
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
  DATABASE_SSL: envBoolean.default(false),
  RAG_TOP_K: z.coerce.number().int().min(2).max(12).default(4),
  RAG_CANDIDATE_MULTIPLIER: z.coerce.number().int().min(3).max(12).default(8),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(25),
  MAX_FILES_PER_UPLOAD: z.coerce.number().int().min(1).max(20).default(8),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
  RATE_LIMIT_CHAT_REQUESTS: z.coerce.number().int().min(1).max(300).default(40),
  RATE_LIMIT_UPLOAD_REQUESTS: z.coerce.number().int().min(1).max(100).default(12),
  OBSERVABILITY_WEBHOOK_URL: optionalUrl,
  OCR_ENABLED: envBoolean.default(true),
  OCR_MAX_PAGES: z.coerce.number().int().min(1).max(10).default(3),
  RESPONSE_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86400).default(900),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppEnv = {
  nodeEnv: "development" | "test" | "production";
  aiProvider: AiProvider;
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
  databaseSsl: boolean;
  ragTopK: number;
  ragCandidateMultiplier: number;
  maxUploadMb: number;
  maxFilesPerUpload: number;
  rateLimitWindowSeconds: number;
  rateLimitChatRequests: number;
  rateLimitUploadRequests: number;
  observabilityWebhookUrl?: string;
  ocrEnabled: boolean;
  ocrMaxPages: number;
  responseCacheTtlSeconds: number;
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
    databaseSsl: cachedEnv.DATABASE_SSL,
    ragTopK: cachedEnv.RAG_TOP_K,
    ragCandidateMultiplier: cachedEnv.RAG_CANDIDATE_MULTIPLIER,
    maxUploadMb: cachedEnv.MAX_UPLOAD_MB,
    maxFilesPerUpload: cachedEnv.MAX_FILES_PER_UPLOAD,
    rateLimitWindowSeconds: cachedEnv.RATE_LIMIT_WINDOW_SECONDS,
    rateLimitChatRequests: cachedEnv.RATE_LIMIT_CHAT_REQUESTS,
    rateLimitUploadRequests: cachedEnv.RATE_LIMIT_UPLOAD_REQUESTS,
    observabilityWebhookUrl: cachedEnv.OBSERVABILITY_WEBHOOK_URL,
    ocrEnabled: cachedEnv.OCR_ENABLED,
    ocrMaxPages: cachedEnv.OCR_MAX_PAGES,
    responseCacheTtlSeconds: cachedEnv.RESPONSE_CACHE_TTL_SECONDS,
    logLevel: cachedEnv.LOG_LEVEL,
  };
}

export function hasProductionVectorStore() {
  const env = getEnv();
  return env.vectorStore === "pgvector" && Boolean(env.databaseUrl);
}

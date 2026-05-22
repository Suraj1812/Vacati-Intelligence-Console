import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import { withRetry } from "@/lib/utils/retry";

export class EmbeddingService {
  async embedTexts(texts: string[]) {
    const env = getEnv();

    if (env.embeddingProvider === "gemini" && env.geminiApiKey) {
      return Promise.all(texts.map((text) => this.embedWithGemini(text)));
    }

    if (env.embeddingProvider === "ollama") {
      return Promise.all(texts.map((text) => this.embedWithOllama(text)));
    }

    if (env.embeddingProvider === "openai-compatible" && env.openAiCompatibleBaseUrl) {
      return this.embedWithOpenAiCompatible(texts);
    }

    logger.debug("Using native local embeddings", { count: texts.length });
    return texts.map((text) => localEmbedding(text, env.embeddingDimensions));
  }

  private async embedWithGemini(text: string) {
    const env = getEnv();
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const result = (await ai.models.embedContent({
      model: env.embeddingModel,
      contents: text,
    })) as {
      embeddings?: Array<{ values?: number[] }>;
      embedding?: { values?: number[] };
      values?: number[];
    };

    const vector =
      result.embeddings?.[0]?.values ?? result.embedding?.values ?? result.values ?? [];

    if (!vector.length) {
      throw new Error("Gemini returned an empty embedding.");
    }

    return normalize(fitDimensions(vector, env.embeddingDimensions));
  }

  private async embedWithOllama(text: string) {
    const env = getEnv();
    const result = (await withRetry(() =>
      fetch(`${env.ollamaBaseUrl.replace(/\/$/, "")}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.ollamaEmbeddingModel,
          prompt: text,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Ollama embeddings returned ${response.status}`);
        }

        return response.json();
      }),
    )) as { embedding?: number[] };

    if (!result.embedding?.length) {
      throw new Error("Ollama returned an empty embedding.");
    }

    return normalize(fitDimensions(result.embedding, env.embeddingDimensions));
  }

  private async embedWithOpenAiCompatible(texts: string[]) {
    const env = getEnv();
    const result = (await withRetry(() =>
      fetch(`${env.openAiCompatibleBaseUrl?.replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.openAiCompatibleApiKey ? { Authorization: `Bearer ${env.openAiCompatibleApiKey}` } : {}),
        },
        body: JSON.stringify({
          model: env.embeddingModel,
          input: texts,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`OpenAI-compatible embeddings returned ${response.status}`);
        }

        return response.json();
      }),
    )) as { data?: Array<{ embedding?: number[] }> };

    const vectors = result.data?.map((item) => item.embedding ?? []) ?? [];
    if (vectors.length !== texts.length || vectors.some((vector) => !vector.length)) {
      throw new Error("OpenAI-compatible endpoint returned incomplete embeddings.");
    }

    return vectors.map((vector) => normalize(fitDimensions(vector, env.embeddingDimensions)));
  }
}

export function localEmbedding(input: string, dimensions = 384) {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  tokens.forEach((token, index) => {
    const primary = Math.abs(hash(`${token}:${index % 7}`)) % dimensions;
    const secondary = Math.abs(hash(token.slice(0, 5))) % dimensions;
    vector[primary] += 1;
    vector[secondary] += 0.45;
  });

  return normalize(vector);
}

function hash(value: string) {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) {
    output = (output << 5) - output + value.charCodeAt(index);
    output |= 0;
  }
  return output;
}

function normalize(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function fitDimensions(vector: number[], dimensions: number) {
  if (vector.length === dimensions) {
    return vector;
  }

  if (vector.length > dimensions) {
    return vector.slice(0, dimensions);
  }

  return [...vector, ...new Array<number>(dimensions - vector.length).fill(0)];
}

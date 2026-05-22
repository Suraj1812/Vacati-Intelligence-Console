import type { AiProvider } from "@/lib/config/env";
import type { AiProviderAdapter, GenerateInput, GenerationChunk, ProviderHealth } from "@/lib/ai/providers/types";
import { withRetry } from "@/lib/utils/retry";

type OpenAiCompatibleOptions = {
  id: AiProvider;
  displayName: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
};

export class OpenAiCompatibleProvider implements AiProviderAdapter {
  readonly id: AiProvider;
  readonly displayName: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly headers: Record<string, string>;

  constructor(options: OpenAiCompatibleOptions) {
    this.id = options.id;
    this.displayName = options.displayName;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.headers = options.headers ?? {};
  }

  async *stream(input: GenerateInput): AsyncGenerator<GenerationChunk> {
    const response = await withRetry(() =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          ...this.headers,
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          temperature: input.temperature ?? 0.25,
          max_tokens: input.maxOutputTokens ?? 900,
          messages: [{ role: "user", content: input.prompt }],
        }),
      }).then(async (result) => {
        if (!result.ok || !result.body) {
          throw new Error(`Provider ${this.displayName} returned ${result.status}`);
        }
        return result;
      }),
    );

    if (!response.body) {
      throw new Error(`${this.displayName} stream was empty.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.replace(/^data:\s*/, "");
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string }; text?: string }>;
          };
          const text = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text ?? "";
          if (text) yield { text };
        } catch {
          continue;
        }
      }
    }
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = performance.now();
    try {
      const result = await fetch(`${this.baseUrl}/models`, {
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          ...this.headers,
        },
      });

      return {
        provider: this.id,
        healthy: result.ok,
        latencyMs: Math.round(performance.now() - startedAt),
        message: result.ok ? `${this.displayName} reachable` : `${this.displayName} returned ${result.status}`,
      };
    } catch (error) {
      return {
        provider: this.id,
        healthy: false,
        latencyMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : `${this.displayName} unreachable`,
      };
    }
  }
}

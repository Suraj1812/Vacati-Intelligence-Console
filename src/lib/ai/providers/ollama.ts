import type { AiProviderAdapter, GenerateInput, GenerationChunk, ProviderHealth } from "@/lib/ai/providers/types";
import { withRetry } from "@/lib/utils/retry";

export class OllamaProvider implements AiProviderAdapter {
  readonly id = "ollama" as const;
  readonly displayName = "Ollama";

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
  ) {}

  async *stream(input: GenerateInput): AsyncGenerator<GenerationChunk> {
    const response = await withRetry(() =>
      fetch(`${this.baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: input.prompt,
          stream: true,
          options: {
            temperature: input.temperature ?? 0.25,
            num_predict: input.maxOutputTokens ?? 900,
          },
        }),
      }).then(async (result) => {
        if (!result.ok || !result.body) {
          throw new Error(`Ollama returned ${result.status}`);
        }
        return result;
      }),
    );

    if (!response.body) {
      throw new Error("Ollama stream was empty.");
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
        if (!line.trim()) continue;
        const parsed = JSON.parse(line) as { response?: string; done?: boolean };
        if (parsed.done) return;
        if (parsed.response) yield { text: parsed.response };
      }
    }
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = performance.now();
    try {
      const result = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/tags`);
      return {
        provider: this.id,
        healthy: result.ok,
        latencyMs: Math.round(performance.now() - startedAt),
        message: result.ok ? "Ollama reachable" : `Ollama returned ${result.status}`,
      };
    } catch (error) {
      return {
        provider: this.id,
        healthy: false,
        latencyMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : "Ollama unreachable",
      };
    }
  }
}

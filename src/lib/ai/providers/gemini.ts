import type { AiProviderAdapter, GenerateInput, GenerationChunk, ProviderHealth } from "@/lib/ai/providers/types";

export class GeminiProvider implements AiProviderAdapter {
  readonly id = "gemini" as const;
  readonly displayName = "Gemini API";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async *stream(input: GenerateInput): AsyncGenerator<GenerationChunk> {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const stream = (await ai.models.generateContentStream({
      model: this.model,
      contents: input.prompt,
      config: {
        temperature: input.temperature ?? 0.25,
        maxOutputTokens: input.maxOutputTokens ?? 900,
      },
    })) as AsyncIterable<{ text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>;

    for await (const chunk of stream) {
      const text = chunk.text ?? chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) {
        yield { text };
      }
    }
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = performance.now();
    return {
      provider: this.id,
      healthy: Boolean(this.apiKey),
      latencyMs: Math.round(performance.now() - startedAt),
      message: this.apiKey ? "Gemini API configured" : "Gemini API key missing",
    };
  }
}

import type { AiProviderAdapter, GenerateInput, GenerationChunk, ProviderHealth } from "@/lib/ai/providers/types";

export class VertexProvider implements AiProviderAdapter {
  readonly id = "vertex" as const;
  readonly displayName = "Google Vertex AI";

  constructor(
    private readonly project: string,
    private readonly location: string,
    readonly model: string,
  ) {}

  async *stream(input: GenerateInput): AsyncGenerator<GenerationChunk> {
    const { VertexAI } = await import("@google-cloud/vertexai");
    const vertex = new VertexAI({
      project: this.project,
      location: this.location,
    });
    const model = vertex.getGenerativeModel({ model: this.model });
    const response = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.25,
        maxOutputTokens: input.maxOutputTokens ?? 900,
      },
    });

    for await (const chunk of response.stream as AsyncIterable<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }>) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (text) {
        yield { text };
      }
    }
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = performance.now();
    return {
      provider: this.id,
      healthy: Boolean(this.project),
      latencyMs: Math.round(performance.now() - startedAt),
      message: this.project ? "Vertex AI configured" : "Google Cloud project missing",
    };
  }
}

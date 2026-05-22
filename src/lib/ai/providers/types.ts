import type { AiProvider } from "@/lib/config/env";

export type GenerationChunk = {
  text: string;
};

export type GenerateInput = {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type ProviderHealth = {
  provider: AiProvider;
  healthy: boolean;
  latencyMs: number;
  message: string;
};

export interface AiProviderAdapter {
  readonly id: AiProvider;
  readonly displayName: string;
  readonly model: string;
  stream(input: GenerateInput): AsyncGenerator<GenerationChunk>;
  health(): Promise<ProviderHealth>;
}

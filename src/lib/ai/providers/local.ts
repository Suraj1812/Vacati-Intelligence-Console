import type { AiProviderAdapter, GenerateInput, GenerationChunk, ProviderHealth } from "@/lib/ai/providers/types";
import type { RetrievalHit } from "@/lib/ai/types";

export class LocalProvider implements AiProviderAdapter {
  readonly id = "local" as const;
  readonly displayName = "Local Extractive";
  readonly model = "local-extractive-rag";

  constructor(private readonly hits: RetrievalHit[] = []) {}

  async *stream(input: GenerateInput): AsyncGenerator<GenerationChunk> {
    const answer = composeExtractiveAnswer(extractQuestion(input.prompt), this.hits);
    const pieces = answer.match(/.{1,28}(\s|$)/g) ?? [answer];

    for (const piece of pieces) {
      yield { text: piece };
    }
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = performance.now();
    const probe = composeExtractiveAnswer("health", []);
    return {
      provider: this.id,
      healthy: true,
      latencyMs: Math.round(performance.now() - startedAt),
      message: probe ? "Local extractive inference available" : "Local extractive inference unavailable",
    };
  }
}

function extractQuestion(prompt: string) {
  return prompt.split("User question:").pop()?.trim() ?? prompt;
}

function composeExtractiveAnswer(question: string, hits: RetrievalHit[]) {
  if (!hits.length) {
    return "I cannot answer because no indexed document context was retrieved for this question.";
  }

  const lead = hits[0];
  const supporting = hits.slice(1, 3);
  const leadSentence = bestSentence(question, lead.content);
  const supportSentences = supporting
    .map((hit, index) => {
      const sentence = bestSentence(question, hit.content);
      return sentence ? `${sentence} [${index + 2}]` : "";
    })
    .filter(Boolean);

  return [`${leadSentence || compact(lead.content)} [1]`, ...supportSentences].join(" ");
}

function bestSentence(question: string, content: string) {
  const terms = tokenize(question);
  const sentences = content
    .replace(/^Section:\s*[^\n]+\n/i, "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences
    .map((sentence) => ({
      sentence,
      score: terms.filter((term) => sentence.toLowerCase().includes(term)).length,
    }))
    .sort((left, right) => right.score - left.score)[0]?.sentence;
}

function compact(value: string) {
  const cleaned = value.replace(/\s+/g, " ").replace(/^Section:\s*/i, "").trim();
  return cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
}

function tokenize(value: string) {
  const stopWords = new Set(["what", "should", "would", "could", "with", "about", "that", "this"]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

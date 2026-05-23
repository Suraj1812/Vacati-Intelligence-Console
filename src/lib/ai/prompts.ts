import type { RetrievalHit } from "@/lib/ai/types";

type PromptTurn = {
  role: "user" | "assistant";
  content: string;
};

export function buildGroundedPrompt(question: string, hits: RetrievalHit[], history: PromptTurn[] = []) {
  const context = hits
    .map(
      (hit, index) =>
        `[${index + 1}] ${hit.documentName} / ${hit.section}\nConfidence: ${hit.confidence}\nMatch: ${hit.matchType}\nScore: ${Math.round(hit.score * 100)}%\n${hit.content}`,
    )
    .join("\n\n");
  const conversation = formatHistory(history);

  return `You are Vacati Intelligence Console, an AI copilot for premium hospitality teams.
Answer only from the retrieved context. If the context does not contain the answer, say that the uploaded knowledge base does not include it and ask one precise follow-up.
Use a calm, confident operator tone. Cite sources inline as [1], [2], etc.
Do not invent menu items, pairings, policies, prices, or operational rules.
Prefer concise paragraphs and short bullets when the answer has multiple parts.

Recent conversation:
${conversation || "No prior turns."}

Retrieved context:
${context}

User question:
${question}`;
}

export function buildGeneralPrompt(question: string, history: PromptTurn[] = []) {
  const conversation = formatHistory(history);

  return `You are Vacati Intelligence Console, a careful AI assistant.
Answer the user's question directly and accurately using general knowledge.
If the question depends on recent facts, live prices, laws, schedules, private data, or anything you cannot verify from the prompt, say what needs verification instead of guessing.
Keep the answer useful, concise, and specific. Do not cite uploaded documents unless retrieved context is provided.
Prefer readable markdown. Use code fences for code.

Recent conversation:
${conversation || "No prior turns."}

User question:
${question}`;
}

function formatHistory(history: PromptTurn[]) {
  return history
    .slice(-8)
    .map((turn) => `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content.slice(0, 900)}`)
    .join("\n");
}

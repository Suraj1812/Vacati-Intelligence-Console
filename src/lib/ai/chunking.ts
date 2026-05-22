import type { IngestibleDocument } from "@/lib/ai/document-types";

export type ChunkInput = IngestibleDocument & {
  id: string;
};

export type TextChunk = {
  content: string;
  index: number;
  section: string;
  tokenEstimate: number;
};

export function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.trim().split(/\s+/).length * 1.32));
}

export async function chunkDocument(document: ChunkInput): Promise<TextChunk[]> {
  const { RecursiveCharacterTextSplitter } = await import("@langchain/textsplitters");
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 620,
    chunkOverlap: 80,
    separators: ["\n\n", "\n", ". ", " "],
  });

  const sections = document.content
    .split(/\n(?=Section:\s)/g)
    .map((section) => section.trim())
    .filter(Boolean);
  const chunks = (
    await Promise.all(
      sections.map(async (section) => {
        const title = inferSection(section);
        const splitSections = await splitter.splitText(section);
        return splitSections.map((content) => ({ content, title }));
      }),
    )
  ).flat();

  return chunks
    .map(({ content, title }, index) => {
      return {
        content: content.trim(),
        index,
        section: title,
        tokenEstimate: estimateTokens(content),
      };
    })
    .filter((chunk) => chunk.content.length > 40);
}

function inferSection(content: string) {
  const firstLine = content.split("\n").find(Boolean);
  if (!firstLine) {
    return "Document excerpt";
  }

  return firstLine.replace(/^Section:\s*/i, "").slice(0, 72);
}

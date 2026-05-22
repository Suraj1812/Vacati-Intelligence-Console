import type { IngestibleDocument } from "@/lib/ai/document-types";

export async function fileToDocument(file: File): Promise<IngestibleDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  const content =
    extension === "pdf" || file.type === "application/pdf"
      ? await extractPdfText(buffer)
      : buffer.toString("utf8");

  return {
    name: file.name,
    type: extension === "pdf" ? "pdf" : "text",
    summary: summarizeText(content),
    tags: inferTags(content),
    content,
  };
}

async function extractPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text.trim();
  } catch {
    throw new Error("PDF text extraction failed. Please upload a selectable-text PDF or a plain text export.");
  }
}

function summarizeText(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 156 ? `${compact.slice(0, 153)}...` : compact;
}

function inferTags(content: string) {
  const value = content.toLowerCase();
  const tags = new Set<string>();

  if (value.includes("wine") || value.includes("pair")) tags.add("pairing");
  if (value.includes("guest") || value.includes("service")) tags.add("hospitality");
  if (value.includes("menu") || value.includes("dish")) tags.add("menu");
  if (value.includes("allergy") || value.includes("dietary")) tags.add("operations");

  return tags.size ? Array.from(tags) : ["uploaded"];
}

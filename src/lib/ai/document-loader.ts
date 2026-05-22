import type { IngestibleDocument } from "@/lib/ai/document-types";
import { inflateRawSync } from "node:zlib";

export async function fileToDocument(file: File): Promise<IngestibleDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  const content = await extractText(buffer, extension, file.type);
  const type = inferDocumentType(extension, file.type);

  if (!content.trim()) {
    throw new Error(`${file.name} did not contain extractable text.`);
  }

  return {
    name: file.name,
    type,
    summary: summarizeText(content),
    tags: inferTags(content),
    content,
  };
}

async function extractText(buffer: Buffer, extension?: string, mimeType?: string) {
  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(buffer);
  }

  return buffer.toString("utf8").trim();
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

function extractDocxText(buffer: Buffer) {
  const documentXml = readZipEntry(buffer, "word/document.xml");
  if (!documentXml) {
    throw new Error("DOCX text extraction failed. The document body could not be found.");
  }

  return xmlToText(documentXml.toString("utf8"));
}

function readZipEntry(buffer: Buffer, targetPath: string) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    throw new Error("DOCX text extraction failed. The file is not a valid DOCX archive.");
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === targetPath) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);

      throw new Error(`DOCX text extraction failed. Unsupported compression method ${method}.`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function xmlToText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function inferDocumentType(extension?: string, mimeType?: string): IngestibleDocument["type"] {
  if (extension === "pdf" || mimeType === "application/pdf") return "pdf";
  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (extension === "md" || extension === "markdown") return "markdown";
  return "text";
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

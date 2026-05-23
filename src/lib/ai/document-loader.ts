import type { IngestibleDocument } from "@/lib/ai/document-types";
import { getEnv } from "@/lib/config/env";
import { inflateRawSync } from "node:zlib";

export async function fileToDocument(file: File): Promise<IngestibleDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = inferExtension(buffer, file.name, file.type);
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

  if (extension === "csv" || mimeType === "text/csv") {
    return extractDelimitedText(buffer.toString("utf8"), ",");
  }

  if (extension === "tsv" || mimeType === "text/tab-separated-values") {
    return extractDelimitedText(buffer.toString("utf8"), "\t");
  }

  if (
    extension === "xlsx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return extractXlsxText(buffer);
  }

  if (isImage(extension, mimeType)) {
    return extractImageText(buffer, mimeType);
  }

  return cleanText(buffer.toString("utf8"));
}

async function extractPdfText(buffer: Buffer) {
  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("PDF text extraction failed. The uploaded file is not a valid PDF.");
  }

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const text = cleanText(parsed.text);
    if (text.length >= 40 || !getEnv().ocrEnabled) {
      await parser.destroy();
      return text;
    }

    const ocrText = await extractPdfOcrText(parser);
    await parser.destroy();
    return cleanText([text, ocrText].filter(Boolean).join("\n\n"));
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("OCR")
        ? error.message
        : "PDF text extraction failed. Please upload a selectable-text PDF or a scanned PDF with readable OCR pages.",
    );
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
  return cleanText(
    decodeXmlEntities(
      xml
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " "),
    ),
  );
}

function extractDelimitedText(value: string, delimiter: "," | "\t") {
  const rows = parseDelimitedRows(value, delimiter).filter((row) => row.some(Boolean));
  if (!rows.length) {
    return "";
  }

  const [headers, ...records] = rows;
  return records
    .slice(0, 5_000)
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, index) => {
          const label = headers[index] || `Column ${index + 1}`;
          return cell ? `${label}: ${cell}` : "";
        })
        .filter(Boolean)
        .join("; ");
      return `Row ${rowIndex + 1}: ${cells}`;
    })
    .join("\n");
}

function parseDelimitedRows(value: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  rows.push(row);
  return rows;
}

function extractXlsxText(buffer: Buffer) {
  const sharedStringsXml = readZipEntry(buffer, "xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = Array.from(sharedStringsXml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)).map((match) =>
    xmlToText(match[1]),
  );
  const workbookXml = readZipEntry(buffer, "xl/workbook.xml")?.toString("utf8") ?? "";
  const sheetNames = Array.from(workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"/g)).map((match) =>
    decodeXmlEntities(match[1]),
  );
  const sheetEntries = listZipEntries(buffer).filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry));

  return sheetEntries
    .slice(0, 12)
    .map((entry, sheetIndex) => {
      const xml = readZipEntry(buffer, entry)?.toString("utf8") ?? "";
      const rows = Array.from(xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g))
        .slice(0, 1_000)
        .map((rowMatch) => {
          const cells = Array.from(rowMatch[1].matchAll(/<c[^>]*(?:t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g))
            .map((cellMatch) => {
              const type = cellMatch[1];
              const value = cellMatch[2].match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
              const inline = cellMatch[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
              if (type === "s") return sharedStrings[Number(value)] ?? "";
              return decodeXmlEntities(inline || value);
            })
            .filter(Boolean);
          return cells.join(" | ");
        })
        .filter(Boolean);
      return `Sheet: ${sheetNames[sheetIndex] ?? `Sheet ${sheetIndex + 1}`}\n${rows.join("\n")}`;
    })
    .filter((sheet) => sheet.trim().length > 20)
    .join("\n\n");
}

async function extractPdfOcrText(parser: { getScreenshot: (params?: never) => Promise<unknown> }) {
  const env = getEnv();
  const screenshots = (await parser.getScreenshot({
    pages: Array.from({ length: env.ocrMaxPages }, (_, index) => index + 1),
    imageBuffer: true,
    scale: 1.4,
  } as never)) as { pages?: Array<{ data?: Uint8Array; image?: { data?: Uint8Array } }> };
  const buffers = (screenshots.pages ?? [])
    .map((page) => page.data ?? page.image?.data)
    .filter((data): data is Uint8Array => Boolean(data));
  const text = await Promise.all(buffers.map((data) => extractImageText(Buffer.from(data), "image/png")));
  const joined = text.filter(Boolean).join("\n\n");
  if (!joined.trim()) {
    throw new Error("PDF OCR failed. The scanned pages did not contain readable text.");
  }
  return joined;
}

async function extractImageText(buffer: Buffer, mimeType?: string) {
  if (!getEnv().ocrEnabled) {
    throw new Error("Image OCR is disabled for this deployment.");
  }

  try {
    const { recognize } = await import("tesseract.js");
    const result = await recognize(buffer, "eng", {
      logger: () => undefined,
    });
    return cleanText(result.data.text);
  } catch {
    throw new Error(`OCR extraction failed for ${mimeType ?? "image"}. Please upload a clearer image or a text export.`);
  }
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
  if (extension === "csv" || extension === "tsv" || mimeType === "text/csv") return "csv";
  if (
    extension === "xlsx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (isImage(extension, mimeType)) return "image";
  if (extension === "md" || extension === "markdown") return "markdown";
  return "text";
}

function inferExtension(buffer: Buffer, fileName: string, mimeType?: string) {
  const lastDot = fileName.lastIndexOf(".");
  const extension = lastDot >= 0 ? fileName.slice(lastDot + 1).toLowerCase() : undefined;
  if (extension) {
    return extension;
  }

  if (mimeType === "application/pdf" || buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return "pdf";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  ) {
    return "docx";
  }

  return undefined;
}

function isImage(extension?: string, mimeType?: string) {
  return (
    Boolean(mimeType?.startsWith("image/")) ||
    extension === "png" ||
    extension === "jpg" ||
    extension === "jpeg" ||
    extension === "webp"
  );
}

function listZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return [];
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: string[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push(buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength));
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function cleanText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\n--\s*\d+\s+of\s+\d+\s*--\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

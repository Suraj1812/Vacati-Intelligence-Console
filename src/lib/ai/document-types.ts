export type IngestibleDocument = {
  name: string;
  type: "pdf" | "docx" | "markdown" | "text" | "csv" | "xlsx" | "image";
  summary: string;
  tags: string[];
  content: string;
};

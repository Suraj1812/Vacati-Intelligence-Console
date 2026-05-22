export type IngestibleDocument = {
  name: string;
  type: "pdf" | "docx" | "markdown" | "text";
  summary: string;
  tags: string[];
  content: string;
};

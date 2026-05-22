export type IngestibleDocument = {
  name: string;
  type: "pdf" | "manual" | "menu" | "wine-guide" | "policy" | "text";
  summary: string;
  tags: string[];
  content: string;
};

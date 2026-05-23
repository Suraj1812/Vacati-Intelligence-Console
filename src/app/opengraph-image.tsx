import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0b0c0a",
          color: "#f4f4f0",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "18px" }}>
            <div
              style={{
                alignItems: "center",
                background: "#f4f4f0",
                color: "#0b0c0a",
                display: "flex",
                fontSize: 32,
                fontWeight: 800,
                height: 56,
                justifyContent: "center",
                width: 56,
              }}
            >
              V
            </div>
            <div style={{ color: "#c9cac3", fontSize: 28 }}>Vacati</div>
          </div>
          <div style={{ color: "#8d9187", fontSize: 24 }}>Intelligence Console</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: 880 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02 }}>
            General answers. Source-backed when it matters.
          </div>
          <div style={{ color: "#c9cac3", fontSize: 30, lineHeight: 1.35 }}>
            Upload documents, retrieve exact context, and keep the console useful even before sources are indexed.
          </div>
        </div>

        <div style={{ color: "#8d9187", display: "flex", fontSize: 24, gap: "32px" }}>
          <span>pgvector</span>
          <span>PDF + DOCX ingestion</span>
          <span>Grounded citations</span>
        </div>
      </div>
    ),
    size,
  );
}

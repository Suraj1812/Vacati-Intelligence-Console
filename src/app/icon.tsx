import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0b0c0a",
          border: "1px solid #2d302a",
          color: "#f4f4f0",
          display: "flex",
          fontSize: 34,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          letterSpacing: 0,
          width: "100%",
        }}
      >
        V
      </div>
    ),
    size,
  );
}

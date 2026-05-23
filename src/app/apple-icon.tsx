import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0b0c0a",
          color: "#f4f4f0",
          display: "flex",
          fontSize: 92,
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

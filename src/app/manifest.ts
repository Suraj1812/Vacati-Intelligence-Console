import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vacati Intelligence Console",
    short_name: "Vacati",
    description: "General answers, document-grounded retrieval, citations, and operational knowledge workflows.",
    start_url: "/",
    display: "standalone",
    background_color: "#070807",
    theme_color: "#070807",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

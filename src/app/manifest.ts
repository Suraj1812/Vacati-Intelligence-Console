import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vacati Intelligence Console",
    short_name: "Vacati",
    description: "Ask questions from your uploaded hospitality documents with grounded sources.",
    start_url: "/",
    display: "standalone",
    background_color: "#070807",
    theme_color: "#070807",
    icons: [
      {
        src: "/logo.jpeg",
        sizes: "200x200",
        type: "image/jpeg",
      },
    ],
  };
}

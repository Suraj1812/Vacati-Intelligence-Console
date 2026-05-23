import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const appName = "Vacati Intelligence Console";
const appDescription =
  "A production intelligence console for general answers, document-grounded retrieval, citations, and operational knowledge workflows.";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getSiteUrl();

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description: appDescription,
    applicationName: appName,
    keywords: [
      "Vacati",
      "intelligence console",
      "RAG",
      "document chat",
      "pgvector",
      "hospitality AI",
      "knowledge base",
    ],
    authors: [{ name: "Vacati" }],
    creator: "Vacati",
    publisher: "Vacati",
    category: "productivity",
    manifest: "/manifest.webmanifest",
    alternates: {
      canonical: "/",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    formatDetection: {
      telephone: false,
      date: false,
      address: false,
      email: false,
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/icon", type: "image/png", sizes: "64x64" },
      ],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
      shortcut: ["/favicon.ico"],
    },
    openGraph: {
      title: appName,
      description: appDescription,
      url: baseUrl,
      siteName: appName,
      locale: "en_US",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Vacati Intelligence Console",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: appName,
      description: appDescription,
      images: ["/opengraph-image"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#070807",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {children}
          <Toaster theme="dark" position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}

function getSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "http://localhost:3000";
  const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return "http://localhost:3000";
  }
}

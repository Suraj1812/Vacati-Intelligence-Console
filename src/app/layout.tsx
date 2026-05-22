import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = "Vacati Intelligence Console";
const appDescription = "Ask questions from your uploaded hospitality documents with grounded sources.";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description: appDescription,
    applicationName: appName,
    icons: {
      icon: "/logo.jpeg",
      apple: "/logo.jpeg",
    },
    openGraph: {
      title: appName,
      description: appDescription,
      url: baseUrl,
      siteName: appName,
      images: [
        {
          url: "/logo.jpeg",
          width: 200,
          height: 200,
          alt: "Vacati",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: appName,
      description: appDescription,
      images: ["/logo.jpeg"],
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {children}
          <Toaster theme="dark" position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}

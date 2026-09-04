import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { LoginModal } from "../components/ui/login-modal";
import { FocusManager } from "./(lib)/FocusManager";
import { SkipLink } from "../components/skip-link";
import { StructuredData } from "../components/seo/structured-data";
import {
  generateOrganizationSchema,
  generateWebApplicationSchema,
} from "../lib/seo/structured-data";

/** App-wide typeface — Orbitron only (variable weight). */
const orbitron = localFont({
  src: "./fonts/Orbitron-VariableFont_wght.ttf",
  variable: "--font-orbitron",
  weight: "100 900",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://masterdeckalchemist.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Master Deck Alchemist",
    template: "%s | Master Deck Alchemist",
  },
  description:
    "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations, deck analysis, and testing tools. Support for Master Duel and TCG formats.",
  keywords: [
    "yu-gi-oh",
    "yugioh",
    "deck builder",
    "master duel",
    "tcg",
    "deck analysis",
    "yugioh deck",
    "card game",
  ],
  authors: [{ name: "Master Deck Alchemist" }],
  creator: "Master Deck Alchemist",
  publisher: "Master Deck Alchemist",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: [
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Master Deck Alchemist",
    title: "Master Deck Alchemist",
    description:
      "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations, deck analysis, and testing tools.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Master Deck Alchemist",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Master Deck Alchemist",
    description:
      "Build and optimize your Yu-Gi-Oh! decks with AI-powered recommendations, deck analysis, and testing tools.",
    images: ["/images/twitter-card.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${orbitron.variable}
          ${orbitron.className}
          min-h-screen
          flex flex-col
          overflow-x-hidden
        `}
      >
        <StructuredData
          data={[generateOrganizationSchema(), generateWebApplicationSchema()]}
        />
        <Providers>
          <SkipLink />
          <FocusManager />
          {children}
          <LoginModal />
        </Providers>
      </body>
    </html>
  );
}
